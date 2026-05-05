import { join, basename } from 'node:path';
import { appendFileSync } from 'node:fs';
import {
  readJsonl, existsSync, readdirSync, ensureDir,
} from '../io.mjs';

/**
 * Entity-keyed append-only JSONL strategy. One .jsonl file per entity id.
 * Each ingested record must carry `_entity_id` (or legacy `_post_id`) which is
 * stripped before persisting and used as the filename stem.
 *
 * If spec.dedupKey is set, records whose dedup value already exists in the
 * entity file are skipped silently.
 *
 * Read({ entity_id }) returns one entity; without it returns all entities flat
 * with `_post_id` re-injected for backwards compatibility with existing readers.
 */
export default {
  storageType: 'entity_jsonl',

  ingest(ctx, spec, records) {
    if (records && !Array.isArray(records)) records = [records];
    if (!records || !records.length) return 0;

    const dirPath = ctx.resolveDir(spec);
    ensureDir(dirPath);
    const dedupKey = spec.dedupKey;

    const grouped = {};
    for (let record of records) {
      record = { ...record };
      const entityId = record._entity_id || record._post_id || '';
      if (!entityId) continue;
      delete record._entity_id;
      delete record._post_id;
      (grouped[entityId] ??= []).push(record);
    }

    let totalWritten = 0;
    for (const [entityId, entityRecords] of Object.entries(grouped)) {
      const filepath = join(dirPath, `${entityId}.jsonl`);

      const existingIds = new Set();
      if (dedupKey && existsSync(filepath)) {
        for (const existing of readJsonl(filepath)) {
          const eid = existing[dedupKey];
          if (eid) existingIds.add(eid);
        }
      }

      try {
        const lines = [];
        for (const record of entityRecords) {
          const rid = dedupKey ? (record[dedupKey] ?? '') : '';
          if (dedupKey && rid && existingIds.has(rid)) continue;
          if (!record.first_seen) record.first_seen = ctx.now();
          lines.push(JSON.stringify(record));
          if (rid) existingIds.add(rid);
          totalWritten++;
        }
        if (lines.length) {
          appendFileSync(filepath, lines.join('\n') + '\n', 'utf-8');
        }
      } catch (e) {
        ctx.logger.error(`[js-intel-store] append ${spec.name}/${entityId} failed: ${e.message}`);
      }
    }
    return totalWritten;
  },

  read(ctx, spec, opts = {}) {
    const dirPath = ctx.resolveDir(spec);
    if (opts.entity_id) {
      return readJsonl(join(dirPath, `${opts.entity_id}.jsonl`));
    }
    const result = [];
    if (!existsSync(dirPath)) return result;
    for (const f of readdirSync(dirPath).sort()) {
      if (!f.endsWith('.jsonl') || f.startsWith('.')) continue;
      const entityId = basename(f, '.jsonl');
      const records = readJsonl(join(dirPath, f));
      for (const r of records) r._post_id = entityId;
      result.push(...records);
    }
    return result;
  },

  cleanup() { return 0; },
  dedupIds() { return new Set(); },
};
