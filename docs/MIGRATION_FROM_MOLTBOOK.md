# Migrating an existing host from embedded IntelligenceStore

This guide is written for the original host (`js-moltbook`) that embedded the
storage code at `src/intelligence/store.mjs`. The same approach applies to any
project that grew its own version of this engine and now wants the kernel
externalised.

## What changes

```
Before:
  host/
    src/intelligence/
      registry.mjs   (DataSourceSpec + DataSourceRegistry + 30+ BUILTIN_SPECS)
      store.mjs      (1200+ lines: storage engine + 33 named methods)

After:
  host/
    src/intelligence/
      specs.mjs      (BUILTIN_SPECS only — host-owned business catalog)
      registry.mjs   (re-export from js-intel-store, kept for import path compat)
      store.mjs      (~250-line facade: build engine + 33 named methods delegating)
  + dependency on js-intel-store
```

## Steps

### 1. Add the dependency

```json
{
  "dependencies": {
    "js-intel-store": "file:../js-intel-store"
  }
}
```

### 2. Move BUILTIN_SPECS into the host

Create `host/src/intelligence/specs.mjs` and move the giant `BUILTIN_SPECS`
object out of the old `registry.mjs`:

```javascript
import { DataSourceSpec } from 'js-intel-store';

export const BUILTIN_SPECS = {
  briefing: new DataSourceSpec({
    name: 'briefing',
    storageType: 'single_json',
    subdir: '',
    filename: 'briefing.json',
    description: '...',
  }),
  // ... all your business sources
};

export const BUILTIN_SPECS_LIST = Object.values(BUILTIN_SPECS);
```

### 3. Shrink registry.mjs to a re-export

Old import paths keep working:

```javascript
export { DataSourceSpec, DataSourceRegistry } from 'js-intel-store';
export { BUILTIN_SPECS } from './specs.mjs';
```

### 4. Rewrite store.mjs as a facade

Wrap the engine and re-implement the 33 named convenience methods as one-liner
delegations:

```javascript
import { StorageEngine, DataSourceRegistry } from 'js-intel-store';
import { BUILTIN_SPECS_LIST } from './specs.mjs';

export class IntelligenceStore {
  constructor(baseDir) {
    const registry = new DataSourceRegistry().registerAll(BUILTIN_SPECS_LIST);
    this.engine = new StorageEngine({
      baseDir,
      registry,
      timezone: 'Asia/Shanghai',
    });
    this.registry = registry;
  }

  // Pass-through generic API
  ingest(name, recs) { return this.engine.ingest(name, recs); }
  readSource(name, opts) { return this.engine.readSource(name, opts); }
  dedupIds(name) { return this.engine.dedupIds(name); }
  cleanupSource(name) { return this.engine.cleanupSource(name); }
  cleanupAllSources() { return this.engine.cleanupAllSources(); }

  // Named conveniences
  readBriefing()         { return this.engine.readSource('briefing'); }
  writeBriefing(data)    { return this.engine.ingest('briefing', data); }
  readAgent(name)        { return this.engine.readSource('agents', { name }); }
  writeAgent(name, data) { return this.engine.ingest('agents', { ...data, name }); }
  // ... and so on for each historical convenience method
}
```

### 5. Verify

- `npm test` (host) should be green with no source files outside
  `src/intelligence/` modified.
- Existing `data/` directory must continue to work — the engine's path layout
  is byte-identical to the original's:
  - `single_json` honours `subdir` (`''` means base dir) and `filename`
  - `entity_json` writes `<dir>/<safeName>.json`
  - `daily_jsonl` writes `<dir>/YYYY-MM-DD.jsonl`
  - `append_jsonl` honours `filename` or defaults to `<name>.jsonl`
  - `entity_jsonl` writes `<dir>/<entityId>.jsonl`
- Spot-check that `readBriefing()` reads the pre-migration `briefing.json`.

## Behavior parity notes

The engine preserves the host's previous behavior in these subtle places:

- `entity_json.ingest` injects `first_seen` / `last_seen` and truncates
  `recent_activity` to last 20.
- `append_jsonl.ingest` injects `timestamp = now()` only when both `timestamp`
  and `started` are missing.
- `entity_jsonl.ingest` strips `_entity_id` / `_post_id` before persisting and
  re-injects `_post_id` on read-all.
- `daily_jsonl.read` returns today first, going back N-1 days.

If your host depended on the `dateToBeijingIso` ISO format, the new
`time.mjs` produces equivalent strings (e.g. `2026-05-05T16:30:00+08:00`)
when the engine is configured with `timezone: 'Asia/Shanghai'`.

## What the new library does NOT include

- `BUILTIN_SPECS` — your catalog stays with you
- 33 business-named methods (`readBriefing`, `writeAgent`, ...) — keep them as
  facade methods in your host
- Cycle/playbook/agent KPI logic — that lives in your domain code
- `_inbox` processor, `getStats`, `getDirectoryManifest`, post archives, my
  posts, snapshots — these are domain-specific and stay in the host facade
  if you still need them, implemented on top of the generic engine API.
