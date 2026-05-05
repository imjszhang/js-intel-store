import { describe, it, expect, afterEach } from 'vitest';
import { makeEngine } from './_helpers.mjs';

let teardown;
afterEach(() => { teardown?.(); teardown = null; });

describe('entity_json strategy', () => {
  it('writes one file per entity keyed by name', () => {
    const { engine, cleanup } = makeEngine([
      { name: 'agents', storageType: 'entity_json' },
    ]);
    teardown = cleanup;
    expect(engine.ingest('agents', [{ name: 'alice', score: 10 }, { name: 'bob', score: 5 }])).toBe(2);
    const all = engine.readSource('agents');
    expect(all).toHaveLength(2);
    expect(engine.readSource('agents', { name: 'alice' })).toMatchObject({ score: 10 });
  });

  it('skips records without name', () => {
    const { engine, cleanup } = makeEngine([
      { name: 'agents', storageType: 'entity_json' },
    ]);
    teardown = cleanup;
    expect(engine.ingest('agents', [{ score: 10 }, { name: 'ok' }])).toBe(1);
  });

  it('merges into existing entity and injects first_seen / last_seen', () => {
    const { engine, cleanup } = makeEngine([
      { name: 'agents', storageType: 'entity_json' },
    ]);
    teardown = cleanup;
    engine.ingest('agents', { name: 'alice', score: 10 });
    const v1 = engine.readSource('agents', { name: 'alice' });
    expect(v1.first_seen).toBeTruthy();
    expect(v1.last_seen).toBeTruthy();

    engine.ingest('agents', { name: 'alice', extra: 'data' });
    const v2 = engine.readSource('agents', { name: 'alice' });
    expect(v2.score).toBe(10);
    expect(v2.extra).toBe('data');
    expect(v2.first_seen).toBe(v1.first_seen);
  });

  it('accepts a single record (not just array)', () => {
    const { engine, cleanup } = makeEngine([
      { name: 'agents', storageType: 'entity_json' },
    ]);
    teardown = cleanup;
    expect(engine.ingest('agents', { name: 'solo' })).toBe(1);
  });

  it('truncates recent_activity to last 20 entries', () => {
    const { engine, cleanup } = makeEngine([
      { name: 'agents', storageType: 'entity_json' },
    ]);
    teardown = cleanup;
    const recent = Array.from({ length: 30 }, (_, i) => ({ i }));
    engine.ingest('agents', { name: 'x', recent_activity: recent });
    const got = engine.readSource('agents', { name: 'x' });
    expect(got.recent_activity).toHaveLength(20);
    expect(got.recent_activity[0]).toEqual({ i: 10 });
  });

  it('safe filename strips path separators', () => {
    const { engine, cleanup } = makeEngine([
      { name: 'agents', storageType: 'entity_json' },
    ]);
    teardown = cleanup;
    engine.ingest('agents', { name: '../evil/name' });
    expect(engine.readSource('agents', { name: '../evil/name' })).toBeTruthy();
  });
});
