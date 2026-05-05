/**
 * @typedef {'single_json' | 'entity_json' | 'entity_jsonl' | 'append_jsonl' | 'daily_jsonl'} StorageType
 */

export const VALID_STORAGE_TYPES = Object.freeze([
  'single_json',
  'entity_json',
  'entity_jsonl',
  'append_jsonl',
  'daily_jsonl',
]);

/**
 * @typedef {Object} DataSourceSpecOptions
 * @property {string} name
 * @property {string} [description]
 * @property {StorageType} storageType
 * @property {number|null} [retentionDays]
 * @property {string|null} [dedupKey]
 * @property {string|null} [subdir]
 * @property {string|null} [filename]
 * @property {string|null} [observerId]
 */

export class DataSourceSpec {
  /**
   * @param {DataSourceSpecOptions} opts
   */
  constructor(opts) {
    if (!opts || typeof opts !== 'object') {
      throw new TypeError('DataSourceSpec requires an options object');
    }
    if (!opts.name || typeof opts.name !== 'string') {
      throw new TypeError('DataSourceSpec.name is required and must be a string');
    }
    if (!VALID_STORAGE_TYPES.includes(opts.storageType)) {
      throw new TypeError(
        `Invalid storageType '${opts.storageType}'. Allowed: ${VALID_STORAGE_TYPES.join(', ')}`,
      );
    }
    this.name = opts.name;
    this.description = opts.description ?? '';
    this.storageType = opts.storageType;
    this.retentionDays = opts.retentionDays ?? null;
    this.dedupKey = opts.dedupKey ?? null;
    this.subdir = opts.subdir ?? null;
    this.filename = opts.filename ?? null;
    this.observerId = opts.observerId ?? null;
    Object.freeze(this);
  }

  getSubdir() {
    return this.subdir ?? this.name;
  }

  getObserverId() {
    return this.observerId ?? `intelligence_${this.name}`;
  }
}

export class DataSourceRegistry {
  constructor() {
    /** @type {Map<string, DataSourceSpec>} */
    this._specs = new Map();
  }

  /**
   * @param {DataSourceSpec} spec
   */
  register(spec) {
    if (!(spec instanceof DataSourceSpec)) {
      throw new TypeError('register() expects a DataSourceSpec instance');
    }
    this._specs.set(spec.name, spec);
    return this;
  }

  /**
   * @param {DataSourceSpec[]} specs
   */
  registerAll(specs) {
    for (const s of specs) this.register(s);
    return this;
  }

  /**
   * @param {string} name
   * @returns {DataSourceSpec|undefined}
   */
  get(name) {
    return this._specs.get(name);
  }

  /**
   * @param {string} name
   * @returns {boolean}
   */
  has(name) {
    return this._specs.has(name);
  }

  /** @returns {DataSourceSpec[]} */
  listAll() {
    return [...this._specs.values()];
  }

  /** @returns {string[]} */
  listNames() {
    return [...this._specs.keys()];
  }

  /** @returns {Array<{id: string, description: string, type: string, source_name: string}>} */
  listDescriptions() {
    return this.listAll().map(spec => ({
      id: spec.getObserverId(),
      description: spec.description,
      type: 'intelligence',
      source_name: spec.name,
    }));
  }

  /**
   * @param {string} observerId
   * @returns {DataSourceSpec|undefined}
   */
  getByObserverId(observerId) {
    for (const spec of this._specs.values()) {
      if (spec.getObserverId() === observerId) return spec;
    }
    return undefined;
  }

  get size() {
    return this._specs.size;
  }

  toString() {
    return `DataSourceRegistry(${this._specs.size} sources: [${this.listNames().join(', ')}])`;
  }
}
