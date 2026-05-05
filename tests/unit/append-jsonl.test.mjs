import { describe, it, expect, afterEach } from 'vitest';
import { makeEngine } from './_helpers.mjs';

let teardown;
afterEach(() => { teardown?.(); teardown = null; });

describe('append_jsonl strategy', () => {
  it('appends records into one growing file', () => {
    const { engine, cleanup } = makeEngine([
      { name: 'experiments', storageType: 'append_jsonl', filename: 'experiments.jsonl' },
    ]);
    teardown = cleanup;
    engine.ingest('experiments', [{ id: '1' }, { id: '2' }]);
    engine.ingest('experiments', [{ id: '3' }]);
    const recs = engine.readSource('experiments', { limit: 100 });
    expect(recs.map(r => r.id)).toEqual(['1', '2', '3']);
  });

  it('injects timestamp when missing', () => {
    const { engine, cleanup } = makeEngine([
      { name: 'experiments', storageType: 'append_jsonl' },
    ]);
    teardown = cleanup;
    engine.ingest('experiments', [{ id: '1' }]);
    const [r] = engine.readSource('experiments');
    expect(r.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('preserves existing timestamp / started fields', () => {
    const { engine, cleanup } = makeEngine([
      { name: 'experiments', storageType: 'append_jsonl' },
    ]);
    teardown = cleanup;
    engine.ingest('experiments', [{ id: 'a', started: '2020-01-01' }, { id: 'b', timestamp: '2020-02-02' }]);
    const recs = engine.readSource('experiments');
    expect(recs[0].started).toBe('2020-01-01');
    expect(recs[0].timestamp).toBeUndefined();
    expect(recs[1].timestamp).toBe('2020-02-02');
  });

  it('limit returns the last N entries', () => {
    const { engine, cleanup } = makeEngine([
      { name: 'experiments', storageType: 'append_jsonl' },
    ]);
    teardown = cleanup;
    engine.ingest('experiments', Array.from({ length: 10 }, (_, i) => ({ id: i })));
    expect(engine.readSource('experiments', { limit: 3 }).map(r => r.id)).toEqual([7, 8, 9]);
  });

  it('accepts a single record (not just array)', () => {
    const { engine, cleanup } = makeEngine([
      { name: 'experiments', storageType: 'append_jsonl' },
    ]);
    teardown = cleanup;
    expect(engine.ingest('experiments', { id: 'solo' })).toBe(1);
  });
});
