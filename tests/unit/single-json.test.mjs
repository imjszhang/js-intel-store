import { describe, it, expect, afterEach } from 'vitest';
import { makeEngine } from './_helpers.mjs';

let teardown;
afterEach(() => { teardown?.(); teardown = null; });

describe('single_json strategy', () => {
  it('writes and reads a document', () => {
    const { engine, cleanup } = makeEngine([
      { name: 'briefing', storageType: 'single_json', subdir: '', filename: 'briefing.json' },
    ]);
    teardown = cleanup;
    expect(engine.ingest('briefing', { hello: 'world' })).toBe(1);
    const doc = engine.readSource('briefing');
    expect(doc.hello).toBe('world');
    expect(doc.updated_at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('rejects arrays / primitives', () => {
    const { engine, cleanup } = makeEngine([
      { name: 'x', storageType: 'single_json' },
    ]);
    teardown = cleanup;
    expect(engine.ingest('x', [1, 2, 3])).toBe(0);
    expect(engine.ingest('x', 'foo')).toBe(0);
    expect(engine.ingest('x', null)).toBe(0);
  });

  it('overwrites existing data on re-ingest', () => {
    const { engine, cleanup } = makeEngine([
      { name: 'x', storageType: 'single_json' },
    ]);
    teardown = cleanup;
    engine.ingest('x', { a: 1 });
    engine.ingest('x', { b: 2 });
    expect(engine.readSource('x')).toMatchObject({ b: 2 });
    expect(engine.readSource('x').a).toBeUndefined();
  });

  it('returns null when source is empty', () => {
    const { engine, cleanup } = makeEngine([
      { name: 'x', storageType: 'single_json' },
    ]);
    teardown = cleanup;
    expect(engine.readSource('x')).toBeNull();
  });
});
