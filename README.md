# js-intel-store

A lightweight time-series + entity hybrid file storage engine. Five storage
strategies (`single_json` / `entity_json` / `entity_jsonl` / `append_jsonl` /
`daily_jsonl`) driven by a registry of declarative `DataSourceSpec`.

Zero runtime dependencies. ESM. Node >= 18.

## Why

You want to persist app-generated data (snapshots, profiles, summaries, daily
metrics) to plain files in a structured way, without dragging in a database.
Each kind of data has different access patterns (one big doc, one file per
entity, daily-rotated logs...). This library gives you those patterns as a
small set of named strategies and lets you mix them under one engine.

## Install

```bash
npm install js-intel-store
```

Or use a local file: dependency:

```json
{
  "dependencies": {
    "js-intel-store": "file:../js-intel-store"
  }
}
```

## Five-minute quickstart

```javascript
import {
  DataSourceSpec,
  DataSourceRegistry,
  StorageEngine,
} from 'js-intel-store';

const registry = new DataSourceRegistry().registerAll([
  new DataSourceSpec({
    name: 'briefing',
    storageType: 'single_json',
    subdir: '',
    filename: 'briefing.json',
  }),
  new DataSourceSpec({
    name: 'agents',
    storageType: 'entity_json',
  }),
  new DataSourceSpec({
    name: 'feeds',
    storageType: 'daily_jsonl',
    retentionDays: 7,
    dedupKey: 'id',
  }),
]);

const engine = new StorageEngine({
  baseDir: './data',
  registry,
  timezone: 'Asia/Shanghai',
});

engine.ingest('briefing', { headline: 'hello' });
engine.ingest('agents', [{ name: 'alice', score: 12 }]);
engine.ingest('feeds', [{ id: 'p1', body: 'snap' }]);

engine.readSource('briefing');                 // { headline: 'hello', updated_at: ... }
engine.readSource('agents', { name: 'alice' });
engine.readSource('feeds', { days: 3 });
engine.dedupIds('feeds');                      // Set { 'p1' }
engine.cleanupAllSources();                    // { feeds: 2 } if 2 old files deleted
```

## Architecture

```
                        StorageEngine
                              |
              +---------------+----------------+
              |               |                |
        DataSourceRegistry   ctx           strategies/
              |               |                |
        DataSourceSpec    timezone-aware    single_json
        (name + type +    now/today/...     entity_json
         subdir/filename                    entity_jsonl
         /retention/                        append_jsonl
         dedupKey)                          daily_jsonl
```

The engine is a thin router: it resolves spec by name, computes the on-disk
path from spec metadata, builds a `StrategyContext`, and dispatches to the
strategy module. Each strategy file owns one storage pattern and nothing else.

## Storage strategies

| storageType    | layout                              | use for                          |
|----------------|-------------------------------------|----------------------------------|
| `single_json`  | one JSON file                       | global summaries, latest state   |
| `entity_json`  | one JSON file per entity (by name)  | profile registries, leaderboards |
| `entity_jsonl` | one JSONL file per entity id        | per-entity append logs (comments)|
| `append_jsonl` | one growing JSONL file              | event log, experiment journal    |
| `daily_jsonl`  | one JSONL per day, with retention   | snapshots, mentions, time series |

See [docs/STRATEGIES.md](./docs/STRATEGIES.md) for field-level details, examples,
and the exact `ingest()` / `read()` / `cleanup()` semantics of each.

## Documentation

- [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) — engine internals + dataflow
- [docs/STRATEGIES.md](./docs/STRATEGIES.md) — per-strategy contract
- [docs/MIGRATION_FROM_MOLTBOOK.md](./docs/MIGRATION_FROM_MOLTBOOK.md) — extraction guide

## Demo

```bash
npm run demo
```

## Testing

```bash
npm test
```

46 unit tests covering spec validation, all 5 strategies, and engine dispatch.

## License

MIT
