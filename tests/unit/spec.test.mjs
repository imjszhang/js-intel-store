import { describe, it, expect } from 'vitest';
import { DataSourceSpec, DataSourceRegistry, VALID_STORAGE_TYPES } from '../../src/spec.mjs';

describe('DataSourceSpec', () => {
  it('validates required fields', () => {
    expect(() => new DataSourceSpec({})).toThrow();
    expect(() => new DataSourceSpec({ name: 'x' })).toThrow();
    expect(() => new DataSourceSpec({ name: 'x', storageType: 'bogus' })).toThrow();
  });

  it('accepts every valid storageType', () => {
    for (const t of VALID_STORAGE_TYPES) {
      const spec = new DataSourceSpec({ name: `n_${t}`, storageType: t });
      expect(spec.storageType).toBe(t);
    }
  });

  it('defaults subdir to name and observerId to intelligence_<name>', () => {
    const spec = new DataSourceSpec({ name: 'feeds', storageType: 'daily_jsonl' });
    expect(spec.getSubdir()).toBe('feeds');
    expect(spec.getObserverId()).toBe('intelligence_feeds');
  });

  it('respects explicit subdir / observerId overrides', () => {
    const spec = new DataSourceSpec({
      name: 'briefing',
      storageType: 'single_json',
      subdir: '',
      observerId: 'custom_id',
      filename: 'briefing.json',
    });
    expect(spec.getSubdir()).toBe('');
    expect(spec.getObserverId()).toBe('custom_id');
    expect(spec.filename).toBe('briefing.json');
  });

  it('is frozen after construction', () => {
    const spec = new DataSourceSpec({ name: 'x', storageType: 'single_json' });
    expect(() => { spec.name = 'y'; }).toThrow();
  });
});

describe('DataSourceRegistry', () => {
  it('starts empty', () => {
    const r = new DataSourceRegistry();
    expect(r.size).toBe(0);
    expect(r.listAll()).toEqual([]);
  });

  it('register / get / has / listNames work', () => {
    const r = new DataSourceRegistry();
    const spec = new DataSourceSpec({ name: 'a', storageType: 'single_json' });
    r.register(spec);
    expect(r.has('a')).toBe(true);
    expect(r.get('a')).toBe(spec);
    expect(r.listNames()).toEqual(['a']);
    expect(r.size).toBe(1);
  });

  it('registerAll bulk loads specs', () => {
    const r = new DataSourceRegistry();
    r.registerAll([
      new DataSourceSpec({ name: 'a', storageType: 'single_json' }),
      new DataSourceSpec({ name: 'b', storageType: 'daily_jsonl' }),
    ]);
    expect(r.size).toBe(2);
  });

  it('register rejects non-spec values', () => {
    const r = new DataSourceRegistry();
    expect(() => r.register({ name: 'x', storageType: 'single_json' })).toThrow();
  });

  it('getByObserverId resolves observer id back to spec', () => {
    const r = new DataSourceRegistry();
    const spec = new DataSourceSpec({ name: 'feeds', storageType: 'daily_jsonl' });
    r.register(spec);
    expect(r.getByObserverId('intelligence_feeds')).toBe(spec);
    expect(r.getByObserverId('nope')).toBeUndefined();
  });

  it('listDescriptions returns metadata array', () => {
    const r = new DataSourceRegistry();
    r.register(new DataSourceSpec({
      name: 'a', storageType: 'single_json', description: 'hello',
    }));
    expect(r.listDescriptions()).toEqual([
      { id: 'intelligence_a', description: 'hello', type: 'intelligence', source_name: 'a' },
    ]);
  });
});
