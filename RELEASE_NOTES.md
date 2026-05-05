# Release Notes

## v0.1.0

> **Initial public library release.** Lightweight time-series + entity hybrid
> file storage: five named strategies (`single_json` / `entity_json` /
> `entity_jsonl` / `append_jsonl` / `daily_jsonl`) behind a registry of
> declarative `DataSourceSpec`, routed by `StorageEngine`. Zero runtime
> dependencies, ESM-only, Node >= 18. On-disk layout matches the historical
> `js-moltbook` IntelligenceStore engine so existing data roots can swap in
> this package without moving files.

### Highlights

- **`DataSourceSpec` + `DataSourceRegistry`** *(2026-05-05)*: frozen metadata
  (`name`, `storageType`, `subdir`, `filename`, `retentionDays`, `dedupKey`,
  `observerId`) and a Map-backed registry with `register` / `registerAll` /
  `listAll` / `getByObserverId` / `listDescriptions`.
- **`StorageEngine`** *(2026-05-05)*: resolves spec by source name, builds a
  timezone-aware `StrategyContext` (`now`, `today`, `dateStrDaysAgo`,
  `safeFilename`, logger), dispatches `ingest` / `read` / `dedupIds` /
  `cleanup` to the strategy module. Optional `strategies` map overrides or
  extends built-ins; optional `logger` implements `{ warn, error }`.
- **Five built-in strategies** *(2026-05-05)*: see
  [`docs/STRATEGIES.md`](docs/STRATEGIES.md) for exact `ingest` / `readSource`
  contracts. `daily_jsonl` uses engine `timezone` for date partitioning;
  `cleanup` respects `retentionDays` where applicable.
- **I/O helpers exported** *(2026-05-05)*: `atomicWriteJson`, `readJson`,
  `appendJsonl`, `appendJsonlBatch`, `readJsonl`, `rewriteJsonl`, `ensureDir`,
  `cleanupOldDateFiles` — same module graph hosts use for ad-hoc paths alongside
  the engine.
- **Quality** *(2026-05-05)*: 46 Vitest unit tests (spec, all strategies,
  engine dispatch); `npm run demo` exercises the public API across all five
  strategies.

### Migration Notes

- **First npm-tracked release.** There is no prior published `js-intel-store`
  version to upgrade from on the registry. If you previously **vendored** the
  engine inside an app (e.g. moltbook pre-extraction), replace the embedded
  copy with `npm install js-intel-store` and keep your host-owned
  `DataSourceSpec` catalogue; see
  [`docs/MIGRATION_FROM_MOLTBOOK.md`](docs/MIGRATION_FROM_MOLTBOOK.md).
- **No breaking API** relative to the extracted engine semantics documented in
  [`CHANGELOG.md`](CHANGELOG.md) for v0.1.0.
- **Concurrency**: there is still no cross-process locking; multi-writer
  append remains a host concern until a future `lockMode` (reserved on the
  engine constructor) lands.

### Downloads

- [npm package `js-intel-store`](https://www.npmjs.com/package/js-intel-store)

### Installation Instructions

#### As a dependency

1. `npm install js-intel-store@0.1.0`
2. `import { DataSourceSpec, DataSourceRegistry, StorageEngine } from 'js-intel-store'`
3. Run `npm test` in your integration path, or probe with the quickstart in
   [`README.md`](README.md).

#### Local / monorepo (`file:`)

1. In the consumer `package.json`:
   `"js-intel-store": "file:../js-intel-store"` (adjust the relative path).
2. `npm install` in the consumer root.

#### Verify the tarball contents

1. From the package root: `npm pack --dry-run`
2. Run the library tests: `npm test`
3. Optional: `npm run demo` — writes under `examples/minimal-demo/data/`
