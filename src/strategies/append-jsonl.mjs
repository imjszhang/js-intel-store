import { appendJsonl, readJsonl } from '../io.mjs';

/**
 * Single growing JSONL file. Append-only, no dedup, no rotation.
 * If a record lacks both `timestamp` and `started`, `timestamp = now()` is injected.
 */
export default {
  storageType: 'append_jsonl',

  ingest(ctx, spec, records) {
    if (records && !Array.isArray(records)) records = [records];
    if (!records || !records.length) return 0;
    const filepath = ctx.resolveFile(spec);
    let count = 0;
    for (const record of records) {
      if (!record.timestamp && !record.started) record.timestamp = ctx.now();
      appendJsonl(filepath, record, ctx.logger);
      count++;
    }
    return count;
  },

  read(ctx, spec, opts = {}) {
    return readJsonl(ctx.resolveFile(spec), opts.limit ?? 50);
  },

  cleanup() { return 0; },
  dedupIds() { return new Set(); },
};
