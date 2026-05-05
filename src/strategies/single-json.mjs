import { atomicWriteJson, readJson } from '../io.mjs';

/**
 * Single JSON file strategy. The whole spec stores one document.
 * Behavior:
 *   - ingest(data): atomic write; injects updated_at = now()
 *   - read(): returns parsed JSON or null
 *   - cleanup(): no-op (single_json has no retention semantics)
 */
export default {
  storageType: 'single_json',

  /**
   * @param {import('../engine.mjs').StrategyContext} ctx
   * @param {import('../spec.mjs').DataSourceSpec} spec
   * @param {Object} data
   * @returns {number} 1 on success, 0 otherwise
   */
  ingest(ctx, spec, data) {
    if (!data || typeof data !== 'object' || Array.isArray(data)) return 0;
    const filepath = ctx.resolveFile(spec);
    data.updated_at = ctx.now();
    atomicWriteJson(filepath, data);
    return 1;
  },

  read(ctx, spec /* , opts */) {
    return readJson(ctx.resolveFile(spec));
  },

  cleanup(/* ctx, spec */) {
    return 0;
  },

  dedupIds() {
    return new Set();
  },
};
