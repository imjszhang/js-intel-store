import { join } from 'node:path';
import { atomicWriteJson, readJson, existsSync, readdirSync } from '../io.mjs';

const RECENT_ACTIVITY_LIMIT = 20;

/**
 * Entity-as-file strategy. One JSON file per entity (filename = safe(name)).
 * Behavior:
 *   - ingest(record | record[]): each record requires `name`. Merges into existing,
 *     injects first_seen on creation and last_seen on every write.
 *     Truncates `recent_activity` to last 20 if present.
 *   - read({ name }): returns one entity, or all if name omitted.
 */
export default {
  storageType: 'entity_json',

  /**
   * @param {import('../engine.mjs').StrategyContext} ctx
   * @param {import('../spec.mjs').DataSourceSpec} spec
   * @param {Object|Object[]} records
   */
  ingest(ctx, spec, records) {
    if (records && !Array.isArray(records)) records = [records];
    if (!records || !records.length) return 0;
    const dirPath = ctx.resolveDir(spec);
    let count = 0;
    for (const record of records) {
      const name = record?.name ?? '';
      if (!name) continue;
      const safeName = ctx.safeFilename(name);
      const filepath = join(dirPath, `${safeName}.json`);
      const existing = readJson(filepath) || {};
      if (!existing.first_seen) existing.first_seen = ctx.now();
      Object.assign(existing, record);
      existing.last_seen = ctx.now();
      if (Array.isArray(existing.recent_activity) && existing.recent_activity.length > RECENT_ACTIVITY_LIMIT) {
        existing.recent_activity = existing.recent_activity.slice(-RECENT_ACTIVITY_LIMIT);
      }
      atomicWriteJson(filepath, existing);
      count++;
    }
    return count;
  },

  read(ctx, spec, opts = {}) {
    const dirPath = ctx.resolveDir(spec);
    if (opts.name) {
      const safeName = ctx.safeFilename(opts.name);
      return readJson(join(dirPath, `${safeName}.json`));
    }
    const result = [];
    if (!existsSync(dirPath)) return result;
    for (const f of readdirSync(dirPath).sort()) {
      if (!f.endsWith('.json') || f.startsWith('.')) continue;
      const data = readJson(join(dirPath, f));
      if (data) result.push(data);
    }
    return result;
  },

  cleanup() { return 0; },
  dedupIds() { return new Set(); },
};
