# Storage strategies

All five strategies share the same engine API
(`ingest` / `readSource` / `dedupIds` / `cleanupSource`); each interprets the
payload and `opts` differently.

## `single_json`

A single JSON document.

- `ingest(data)`: object only (arrays / primitives rejected). Writes
  atomically. Injects `data.updated_at = now()`.
- `readSource()`: returns the parsed object, or `null` if file does not exist.
- `cleanup()`: no-op.

```javascript
engine.ingest('briefing', { headline: 'hello' });
engine.readSource('briefing');
// => { headline: 'hello', updated_at: '2026-05-05T16:30:00+08:00' }
```

## `entity_json`

One JSON file per entity, keyed by `record.name`.

- `ingest(record | records[])`: each record must have `name`. Records without
  one are skipped silently. Existing files are merged (new fields overwrite
  old). On creation `first_seen = now()`; on every write `last_seen = now()`.
  If `record.recent_activity` is an array it is truncated to the last 20.
- `readSource({ name })`: returns one entity, or `null`.
- `readSource()`: returns all entities as an array (sorted by filename).
- `cleanup()`: no-op.

The filename is `safeFilename(name).json`. `safeFilename` replaces `/`, `\`,
`..`, space, and NUL with `_`.

## `entity_jsonl`

One JSONL file per entity id; each entity file is append-only.

- `ingest(records[])`: each record needs `_entity_id` (or legacy `_post_id`).
  The id field is stripped before persisting and used as the filename stem.
  If `spec.dedupKey` is set, records whose dedup value is already present in
  the entity file are skipped.
  If a record has no `first_seen`, one is injected.
- `readSource({ entity_id })`: returns records for one entity.
- `readSource()`: returns records for all entities, with `_post_id` re-injected
  per record (kept for backwards compatibility).
- `cleanup()`: no-op.

## `append_jsonl`

A single growing JSONL file.

- `ingest(record | records[])`: each record without `timestamp` or `started`
  gets `timestamp = now()`. Records are appended in order.
- `readSource({ limit = 50 })`: returns the last `limit` records (or all if
  there are fewer).
- `cleanup()`: no-op.

Filename defaults to `<spec.name>.jsonl` unless `spec.filename` is set.

## `daily_jsonl`

One JSONL per day (`YYYY-MM-DD.jsonl`) inside the spec's directory. Date is
computed in the engine's configured timezone.

- `ingest(records[])`: batch-appended into today's file. Returns the number
  of records written.
- `readSource({ days = 3 })`: concatenates today + (days-1) previous days,
  in **today-first** order.
- `dedupIds()`: requires `spec.dedupKey`. Returns the set of dedup values
  already present in **today's** file (used as a "skip these on next
  ingest" filter by callers).
- `cleanup()`: requires `spec.retentionDays`. Deletes any file whose date stem
  is strictly older than `today - retentionDays`. Returns deleted count.

## Choosing a strategy

| You need...                                                | Use            |
|------------------------------------------------------------|----------------|
| Latest snapshot of one global object                       | `single_json`  |
| A directory of named profiles, randomly accessed by name   | `entity_json`  |
| A growing log per entity, with optional dedup              | `entity_jsonl` |
| One growing log file with no rotation                      | `append_jsonl` |
| Time-series data with retention and per-day dedup          | `daily_jsonl`  |
