import { describe, it, expect, afterEach } from 'vitest';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { makeEngine } from './_helpers.mjs';
import { StorageEngine } from '../../src/engine.mjs';
import { DataSourceRegistry, DataSourceSpec } from '../../src/spec.mjs';

let teardown;
afterEach(() => { teardown?.(); teardown = null; });

describe('StorageEngine', () => {
  it('throws on missing baseDir', () => {
    expect(() => new StorageEngine({})).toThrow();
  });

  it('throws on unregistered source', () => {
    const { engine, cleanup } = makeEngine([]);
    teardown = cleanup;
    expect(() => engine.ingest('nope', {})).toThrow(/Unregistered/);
    expect(() => engine.readSource('nope')).toThrow(/Unregistered/);
  });

  it('routes each storageType to the correct strategy', () => {
    const { engine, cleanup } = makeEngine([
      { name: 's1', storageType: 'single_json' },
      { name: 's2', storageType: 'entity_json' },
      { name: 's3', storageType: 'entity_jsonl' },
      { name: 's4', storageType: 'append_jsonl' },
      { name: 's5', storageType: 'daily_jsonl' },
    ]);
    teardown = cleanup;
    expect(engine.ingest('s1', { x: 1 })).toBe(1);
    expect(engine.ingest('s2', { name: 'a' })).toBe(1);
    expect(engine.ingest('s3', { _entity_id: 'p', body: 'b' })).toBe(1);
    expect(engine.ingest('s4', { id: 'q' })).toBe(1);
    expect(engine.ingest('s5', { id: 'd' })).toBe(1);
  });

  it('resolves directory layout: subdir defaults to spec.name; empty subdir uses baseDir', () => {
    const { engine, baseDir, cleanup } = makeEngine([
      { name: 'briefing', storageType: 'single_json', subdir: '', filename: 'briefing.json' },
      { name: 'feeds', storageType: 'daily_jsonl' },
    ]);
    teardown = cleanup;
    engine.ingest('briefing', { hello: 1 });
    engine.ingest('feeds', { id: 1 });
    expect(existsSync(join(baseDir, 'briefing.json'))).toBe(true);
    expect(existsSync(join(baseDir, 'feeds'))).toBe(true);
  });

  it('respects explicit filename for single_json / append_jsonl', () => {
    const { engine, baseDir, cleanup } = makeEngine([
      { name: 'plays', storageType: 'single_json', filename: 'playbook.json' },
      { name: 'exp', storageType: 'append_jsonl', filename: 'experiments.jsonl' },
    ]);
    teardown = cleanup;
    engine.ingest('plays', { v: 1 });
    engine.ingest('exp', { id: 1 });
    expect(existsSync(join(baseDir, 'plays', 'playbook.json'))).toBe(true);
    expect(existsSync(join(baseDir, 'exp', 'experiments.jsonl'))).toBe(true);
  });

  it('falls back to <name>.json / <name>.jsonl when filename omitted', () => {
    const { engine, baseDir, cleanup } = makeEngine([
      { name: 'a', storageType: 'single_json' },
      { name: 'b', storageType: 'append_jsonl' },
    ]);
    teardown = cleanup;
    engine.ingest('a', { x: 1 });
    engine.ingest('b', { x: 1 });
    expect(existsSync(join(baseDir, 'a', 'a.json'))).toBe(true);
    expect(existsSync(join(baseDir, 'b', 'b.jsonl'))).toBe(true);
  });

  it('accepts pre-built registry', () => {
    const reg = new DataSourceRegistry();
    reg.register(new DataSourceSpec({ name: 'x', storageType: 'single_json' }));
    const { cleanup } = makeEngine([]);
    teardown = cleanup;
    const e = new StorageEngine({ baseDir: '/tmp', registry: reg, timezone: 'UTC' });
    expect(e.registry.size).toBe(1);
  });

  it('cleanupAllSources only reports non-zero deletions', () => {
    const { engine, cleanup } = makeEngine([
      { name: 'x', storageType: 'single_json' },
      { name: 'y', storageType: 'daily_jsonl' },
    ]);
    teardown = cleanup;
    expect(engine.cleanupAllSources()).toEqual({});
  });
});
