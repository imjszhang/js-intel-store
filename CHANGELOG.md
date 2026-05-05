# Changelog

## v0.1.0 (initial release)

### Added

- `DataSourceSpec` and `DataSourceRegistry` for declarative source metadata.
- `StorageEngine` with five built-in storage strategies:
  - `single_json` — atomic single-document storage
  - `entity_json` — one JSON file per named entity, merge semantics
  - `entity_jsonl` — one JSONL per entity id, optional dedup
  - `append_jsonl` — single growing JSONL log
  - `daily_jsonl` — date-partitioned JSONL with retention + dedup
- Timezone-aware date helpers (`nowInTz`, `todayInTz`, `dateStrDaysAgo`).
- File primitives: atomic JSON write, JSONL append/read, date-stem cleanup.
- Custom strategy injection via `new StorageEngine({ strategies })`.
- Pluggable logger (`{ warn, error }`); defaults to `console.error`.
- Minimal demo (`npm run demo`) exercising all five strategies.
- 46 unit tests across spec, all five strategies, and engine dispatch.
- Extraction guide for hosts migrating from an embedded copy of this engine.

### Notes

- Zero runtime dependencies. ESM only. Node >= 18.
- Path layout matches the original `js-moltbook` IntelligenceStore byte-for-byte
  so existing data directories migrate without any file moves.

### Limitations

- No cross-process file locking (`appendFileSync` only). A `lockMode` option is
  reserved on the engine constructor for a future minor release.
- No streaming reads — full file is buffered in memory. Suitable for the kinds
  of working sets these strategies were designed for (millions of small JSONL
  records, not gigabytes).
