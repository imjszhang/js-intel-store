import { join } from 'node:path';
import { ensureDir, makeLogger } from './io.mjs';
import { nowInTz, todayInTz, dateStrDaysAgo } from './time.mjs';
import { DataSourceRegistry } from './spec.mjs';

import singleJson from './strategies/single-json.mjs';
import entityJson from './strategies/entity-json.mjs';
import entityJsonl from './strategies/entity-jsonl.mjs';
import appendJsonl from './strategies/append-jsonl.mjs';
import dailyJsonl from './strategies/daily-jsonl.mjs';

const BUILTIN_STRATEGIES = Object.freeze({
  single_json: singleJson,
  entity_json: entityJson,
  entity_jsonl: entityJsonl,
  append_jsonl: appendJsonl,
  daily_jsonl: dailyJsonl,
});

/**
 * @typedef {Object} StrategyContext
 * @property {string} baseDir
 * @property {(spec: import('./spec.mjs').DataSourceSpec) => string} resolveDir
 * @property {(spec: import('./spec.mjs').DataSourceSpec) => string} resolveFile
 * @property {() => string} now    ISO timestamp in engine timezone
 * @property {() => string} today  YYYY-MM-DD in engine timezone
 * @property {(daysAgo: number) => string} dateStrDaysAgo
 * @property {(name: string) => string} safeFilename
 * @property {{warn: Function, error: Function}} logger
 */

/**
 * @typedef {Object} StorageEngineOptions
 * @property {string} baseDir absolute or relative root directory under which all data lives
 * @property {DataSourceRegistry} [registry]
 * @property {string} [timezone='UTC'] IANA timezone for date partitioning + ISO timestamps
 * @property {{warn?: Function, error?: Function}} [logger]
 * @property {Record<string, object>} [strategies] override or extend built-in strategies
 */

export class StorageEngine {
  /**
   * @param {StorageEngineOptions} opts
   */
  constructor(opts) {
    if (!opts || !opts.baseDir) {
      throw new TypeError('StorageEngine requires { baseDir }');
    }
    this.baseDir = opts.baseDir;
    this.registry = opts.registry ?? new DataSourceRegistry();
    this.timezone = opts.timezone ?? 'UTC';
    this.logger = makeLogger(opts.logger);
    this.strategies = { ...BUILTIN_STRATEGIES, ...(opts.strategies ?? {}) };

    ensureDir(this.baseDir);

    this._ctx = Object.freeze({
      baseDir: this.baseDir,
      resolveDir: spec => this._resolveDir(spec),
      resolveFile: spec => this._resolveFile(spec),
      now: () => nowInTz(this.timezone),
      today: () => todayInTz(this.timezone),
      dateStrDaysAgo: n => dateStrDaysAgo(n, this.timezone),
      safeFilename: name => this._safeFilename(name),
      logger: this.logger,
    });
  }

  // ==================== Public API ====================

  /**
   * Write records to a registered source. The actual write semantics depend on
   * the spec's storageType — see strategies/*.mjs.
   * @param {string} sourceName
   * @param {*} records single record, array of records, or single document
   * @returns {number} number of records written / merged
   */
  ingest(sourceName, records) {
    const { spec, strategy } = this._resolve(sourceName);
    return strategy.ingest(this._ctx, spec, records);
  }

  /**
   * Read records from a registered source. Options vary per strategy.
   * @param {string} sourceName
   * @param {Object} [opts]
   * @returns {*}
   */
  readSource(sourceName, opts = {}) {
    const { spec, strategy } = this._resolve(sourceName);
    return strategy.read(this._ctx, spec, opts);
  }

  /**
   * For daily_jsonl with a configured dedupKey: returns the set of dedup ids
   * already present in today's file. Other strategies return an empty set.
   * @param {string} sourceName
   * @returns {Set<string>}
   */
  dedupIds(sourceName) {
    const { spec, strategy } = this._resolve(sourceName);
    return strategy.dedupIds(this._ctx, spec);
  }

  /**
   * @param {string} sourceName
   * @returns {number} number of files deleted
   */
  cleanupSource(sourceName) {
    const { spec, strategy } = this._resolve(sourceName);
    return strategy.cleanup(this._ctx, spec);
  }

  /**
   * Run cleanup() across all registered sources. Returns a map of sourceName -> deletedCount
   * for sources that actually deleted anything.
   * @returns {Record<string, number>}
   */
  cleanupAllSources() {
    const out = {};
    for (const spec of this.registry.listAll()) {
      const strategy = this.strategies[spec.storageType];
      if (!strategy) continue;
      const n = strategy.cleanup(this._ctx, spec);
      if (n > 0) out[spec.name] = n;
    }
    return out;
  }

  // ==================== Internals (exposed for tests / advanced use) ====================

  _resolve(sourceName) {
    const spec = this.registry.get(sourceName);
    if (!spec) throw new Error(`Unregistered data source: '${sourceName}'`);
    const strategy = this.strategies[spec.storageType];
    if (!strategy) throw new Error(`Unknown storage strategy: '${spec.storageType}'`);
    return { spec, strategy };
  }

  _resolveDir(spec) {
    const subdir = spec.getSubdir();
    if (!subdir) {
      ensureDir(this.baseDir);
      return this.baseDir;
    }
    const dirPath = join(this.baseDir, subdir);
    ensureDir(dirPath);
    return dirPath;
  }

  _resolveFile(spec) {
    const dirPath = this._resolveDir(spec);
    if (spec.filename) return join(dirPath, spec.filename);
    if (spec.storageType === 'single_json') return join(dirPath, `${spec.name}.json`);
    if (spec.storageType === 'append_jsonl') return join(dirPath, `${spec.name}.jsonl`);
    return join(dirPath, spec.name);
  }

  _safeFilename(name) {
    return String(name)
      .replace(/\//g, '_')
      .replace(/\\/g, '_')
      .replace(/\.\./g, '_')
      .replace(/ /g, '_')
      .replace(/\0/g, '');
  }

  _today() { return this._ctx.today(); }
  _now() { return this._ctx.now(); }
  _dateStrDaysAgo(n) { return this._ctx.dateStrDaysAgo(n); }
}
