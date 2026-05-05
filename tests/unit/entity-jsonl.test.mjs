import { describe, it, expect, afterEach } from 'vitest';
import { makeEngine } from './_helpers.mjs';

let teardown;
afterEach(() => { teardown?.(); teardown = null; });

describe('entity_jsonl strategy', () => {
  it('groups records by _entity_id into one file per entity', () => {
    const { engine, cleanup } = makeEngine([
      { name: 'comments', storageType: 'entity_jsonl' },
    ]);
    teardown = cleanup;
    expect(engine.ingest('comments', [
      { _entity_id: 'p1', body: 'a' },
      { _entity_id: 'p1', body: 'b' },
      { _entity_id: 'p2', body: 'c' },
    ])).toBe(3);

    const all = engine.readSource('comments');
    expect(all).toHaveLength(3);
    const oneEntity = engine.readSource('comments', { entity_id: 'p1' });
    expect(oneEntity).toHaveLength(2);
    expect(oneEntity[0]._entity_id).toBeUndefined();
  });

  it('dedups by spec.dedupKey within an entity', () => {
    const { engine, cleanup } = makeEngine([
      { name: 'comments', storageType: 'entity_jsonl', dedupKey: 'id' },
    ]);
    teardown = cleanup;
    engine.ingest('comments', [{ _entity_id: 'p1', id: 'c1', body: 'a' }]);
    const written = engine.ingest('comments', [
      { _entity_id: 'p1', id: 'c1', body: 'dup' },
      { _entity_id: 'p1', id: 'c2', body: 'new' },
    ]);
    expect(written).toBe(1);
    expect(engine.readSource('comments', { entity_id: 'p1' })).toHaveLength(2);
  });

  it('skips records without entity id', () => {
    const { engine, cleanup } = makeEngine([
      { name: 'comments', storageType: 'entity_jsonl' },
    ]);
    teardown = cleanup;
    expect(engine.ingest('comments', [{ body: 'orphan' }])).toBe(0);
  });

  it('reads-all reinjects _post_id for backwards compat', () => {
    const { engine, cleanup } = makeEngine([
      { name: 'comments', storageType: 'entity_jsonl' },
    ]);
    teardown = cleanup;
    engine.ingest('comments', [{ _entity_id: 'p1', body: 'a' }]);
    const all = engine.readSource('comments');
    expect(all[0]._post_id).toBe('p1');
  });

  it('legacy _post_id field is also accepted as entity id', () => {
    const { engine, cleanup } = makeEngine([
      { name: 'comments', storageType: 'entity_jsonl' },
    ]);
    teardown = cleanup;
    expect(engine.ingest('comments', [{ _post_id: 'legacy', body: 'a' }])).toBe(1);
    expect(engine.readSource('comments', { entity_id: 'legacy' })).toHaveLength(1);
  });
});
