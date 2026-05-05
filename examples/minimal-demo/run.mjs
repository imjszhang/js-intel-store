#!/usr/bin/env node
/**
 * Minimal end-to-end demo for js-intel-store.
 * Exercises all 5 storage strategies through the public API only — zero
 * dependency on any host application.
 */
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { rmSync } from 'node:fs';

import {
  DataSourceRegistry,
  StorageEngine,
} from '../../src/index.mjs';
import { DEMO_SPECS } from './specs.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const baseDir = join(__dirname, 'data');

rmSync(baseDir, { recursive: true, force: true });

const registry = new DataSourceRegistry().registerAll(DEMO_SPECS);
const engine = new StorageEngine({
  baseDir,
  registry,
  timezone: 'UTC',
});

console.log('--- single_json ---');
engine.ingest('briefing', { title: 'demo', tags: ['hello', 'world'] });
console.log('briefing =', engine.readSource('briefing'));

console.log('\n--- entity_json ---');
engine.ingest('agents', [
  { name: 'alice', score: 10 },
  { name: 'bob', score: 3 },
]);
engine.ingest('agents', { name: 'alice', score: 12, recent_activity: [{ a: 1 }] });
console.log('alice =', engine.readSource('agents', { name: 'alice' }));
console.log('all agents count =', engine.readSource('agents').length);

console.log('\n--- append_jsonl ---');
engine.ingest('experiments', [{ id: 'e1', hypothesis: 'foo' }, { id: 'e2', hypothesis: 'bar' }]);
console.log('experiments =', engine.readSource('experiments'));

console.log('\n--- daily_jsonl ---');
engine.ingest('feeds', [{ id: 'f1', body: 'hi' }, { id: 'f2', body: 'there' }]);
const beforeDedup = engine.dedupIds('feeds');
console.log('today dedup ids =', [...beforeDedup]);
console.log('feeds (last 3 days) =', engine.readSource('feeds', { days: 3 }));

console.log('\n--- entity_jsonl ---');
engine.ingest('comments', [
  { _entity_id: 'p1', id: 'c1', body: 'first' },
  { _entity_id: 'p1', id: 'c2', body: 'second' },
  { _entity_id: 'p2', id: 'c3', body: 'other-post' },
]);
const dups = engine.ingest('comments', [{ _entity_id: 'p1', id: 'c1', body: 'dup' }]);
console.log('dup ingest wrote =', dups);
console.log('p1 comments =', engine.readSource('comments', { entity_id: 'p1' }));

console.log('\n--- cleanup ---');
console.log('cleanupAllSources =', engine.cleanupAllSources());

console.log('\nDemo OK. Data dir:', baseDir);
