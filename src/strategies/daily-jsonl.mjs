import { join, basename } from 'node:path';
import { appendFileSync } from 'node:fs';
import {
  readJsonl, ensureDir, existsSync, readdirSync, unlinkSync,
} from '../io.mjs';

/**
 * Time-partitioned JSONL strategy. One .jsonl per day (filename = YYYY-MM-DD.jsonl
 * in the engine's configured timezone).
 * - ingest(records): batch-appended to today's file
 * - read({ days = 3 }): records from the last N days, today first then going back
 * - cleanup(): deletes files whose date stem is older than spec.retentionDays
 * - dedupIds(): for spec with dedupKey, returns the set of ids seen in today's file
 */
export default {
  storageType: 'daily_jsonl',

  ingest(ctx, spec, records) {
    if (records && !Array.isArray(records)) records = [records];
    if (!records || !records.length) return 0;
    const dirPath = ctx.resolveDir(spec);
    ensureDir(dirPath);
    const filepath = join(dirPath, `${ctx.today()}.jsonl`);
    try {
      const lines = records.map(r => JSON.stringify(r)).join('\n') + '\n';
      appendFileSync(filepath, lines, 'utf-8');
      return records.length;
    } catch (e) {
      ctx.logger.error(`[js-intel-store] append ${spec.name} failed: ${e.message}`);
      return 0;
    }
  },

  read(ctx, spec, opts = {}) {
    const days = opts.days ?? 3;
    const dirPath = ctx.resolveDir(spec);
    const records = [];
    for (let i = 0; i < days; i++) {
      const dateStr = ctx.dateStrDaysAgo(i);
      records.push(...readJsonl(join(dirPath, `${dateStr}.jsonl`)));
    }
    return records;
  },

  /**
   * @returns {number} count of files deleted
   */
  cleanup(ctx, spec) {
    if (spec.retentionDays == null) return 0;
    const dirPath = ctx.resolveDir(spec);
    if (!existsSync(dirPath)) return 0;
    const cutoff = ctx.dateStrDaysAgo(spec.retentionDays);
    let deleted = 0;
    for (const f of readdirSync(dirPath)) {
      if (!f.endsWith('.jsonl')) continue;
      const stem = basename(f, '.jsonl');
      if (stem < cutoff) {
        try {
          unlinkSync(join(dirPath, f));
          deleted++;
        } catch { /* ignore */ }
      }
    }
    return deleted;
  },

  dedupIds(ctx, spec) {
    if (!spec.dedupKey) return new Set();
    const dirPath = ctx.resolveDir(spec);
    const filepath = join(dirPath, `${ctx.today()}.jsonl`);
    const ids = new Set();
    for (const r of readJsonl(filepath)) {
      const v = r[spec.dedupKey];
      if (v) ids.add(v);
    }
    return ids;
  },
};
