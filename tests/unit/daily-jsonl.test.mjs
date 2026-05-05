import { describe, it, expect, afterEach } from 'vitest';
import { join } from 'node:path';
import { writeFileSync, existsSync, readdirSync, mkdirSync } from 'node:fs';
import { makeEngine } from './_helpers.mjs';

let teardown;
afterEach(() => { teardown?.(); teardown = null; });

describe('daily_jsonl strategy', () => {
  it('writes today\'s records into YYYY-MM-DD.jsonl', () => {
    const { engine, baseDir, cleanup } = makeEngine([
      { name: 'feeds', storageType: 'daily_jsonl' },
    ], { timezone: 'UTC' });
    teardown = cleanup;
    expect(engine.ingest('feeds', [{ id: 'a' }, { id: 'b' }])).toBe(2);
    const files = readdirSync(join(baseDir, 'feeds')).filter(f => f.endsWith('.jsonl'));
    expect(files).toHaveLength(1);
    expect(files[0]).toMatch(/^\d{4}-\d{2}-\d{2}\.jsonl$/);
  });

  it('reads N days back, today first', () => {
    const { engine, baseDir, cleanup } = makeEngine([
      { name: 'feeds', storageType: 'daily_jsonl' },
    ], { timezone: 'UTC' });
    teardown = cleanup;
    const dir = join(baseDir, 'feeds');
    mkdirSync(dir, { recursive: true });

    const today = engine._today();
    const yesterday = engine._dateStrDaysAgo(1);
    writeFileSync(join(dir, `${yesterday}.jsonl`), JSON.stringify({ d: 'y' }) + '\n');
    writeFileSync(join(dir, `${today}.jsonl`), JSON.stringify({ d: 't' }) + '\n');

    const recs = engine.readSource('feeds', { days: 2 });
    expect(recs.map(r => r.d)).toEqual(['t', 'y']);
  });

  it('cleanup deletes files older than retentionDays', () => {
    const { engine, baseDir, cleanup } = makeEngine([
      { name: 'feeds', storageType: 'daily_jsonl', retentionDays: 3 },
    ], { timezone: 'UTC' });
    teardown = cleanup;
    const dir = join(baseDir, 'feeds');
    mkdirSync(dir, { recursive: true });

    writeFileSync(join(dir, `${engine._today()}.jsonl`), 'x\n');
    writeFileSync(join(dir, `${engine._dateStrDaysAgo(2)}.jsonl`), 'x\n');
    writeFileSync(join(dir, `${engine._dateStrDaysAgo(10)}.jsonl`), 'x\n');
    writeFileSync(join(dir, `${engine._dateStrDaysAgo(20)}.jsonl`), 'x\n');

    const deleted = engine.cleanupSource('feeds');
    expect(deleted).toBe(2);
    const remaining = readdirSync(dir);
    expect(remaining).toHaveLength(2);
  });

  it('cleanup is no-op without retentionDays', () => {
    const { engine, cleanup } = makeEngine([
      { name: 'feeds', storageType: 'daily_jsonl' },
    ]);
    teardown = cleanup;
    expect(engine.cleanupSource('feeds')).toBe(0);
  });

  it('dedupIds returns ids seen in today\'s file', () => {
    const { engine, cleanup } = makeEngine([
      { name: 'feeds', storageType: 'daily_jsonl', dedupKey: 'id' },
    ]);
    teardown = cleanup;
    engine.ingest('feeds', [{ id: 'x' }, { id: 'y' }]);
    const ids = engine.dedupIds('feeds');
    expect(ids.has('x')).toBe(true);
    expect(ids.has('y')).toBe(true);
    expect(ids.size).toBe(2);
  });

  it('cleanupAllSources only touches daily_jsonl with retention', () => {
    const { engine, baseDir, cleanup } = makeEngine([
      { name: 'feeds', storageType: 'daily_jsonl', retentionDays: 1 },
      { name: 'briefing', storageType: 'single_json' },
      { name: 'agents', storageType: 'entity_json' },
    ]);
    teardown = cleanup;
    const dir = join(baseDir, 'feeds');
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, `${engine._dateStrDaysAgo(5)}.jsonl`), 'x\n');
    const result = engine.cleanupAllSources();
    expect(result.feeds).toBe(1);
    expect(Object.keys(result)).toEqual(['feeds']);
  });

  it('respects timezone parameter for partition filenames', () => {
    const { engine, baseDir, cleanup } = makeEngine([
      { name: 'feeds', storageType: 'daily_jsonl' },
    ], { timezone: 'Asia/Shanghai' });
    teardown = cleanup;
    engine.ingest('feeds', [{ id: 'a' }]);
    const files = readdirSync(join(baseDir, 'feeds'));
    expect(files[0]).toMatch(/^\d{4}-\d{2}-\d{2}\.jsonl$/);
  });
});
