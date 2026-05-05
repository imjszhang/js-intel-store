import { DataSourceSpec } from '../../src/index.mjs';

export const DEMO_SPECS = [
  new DataSourceSpec({
    name: 'briefing',
    description: 'Singleton document holding the latest summary.',
    storageType: 'single_json',
    subdir: '',
    filename: 'briefing.json',
  }),
  new DataSourceSpec({
    name: 'agents',
    description: 'One JSON per agent profile.',
    storageType: 'entity_json',
  }),
  new DataSourceSpec({
    name: 'experiments',
    description: 'Append-only experiment log.',
    storageType: 'append_jsonl',
    filename: 'experiments.jsonl',
  }),
  new DataSourceSpec({
    name: 'feeds',
    description: 'Daily-partitioned feed snapshots, kept for 7 days.',
    storageType: 'daily_jsonl',
    retentionDays: 7,
    dedupKey: 'id',
  }),
  new DataSourceSpec({
    name: 'comments',
    description: 'Per-post comment archives with dedup.',
    storageType: 'entity_jsonl',
    dedupKey: 'id',
  }),
];
