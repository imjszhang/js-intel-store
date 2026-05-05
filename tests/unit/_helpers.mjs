import { mkdtempSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { DataSourceRegistry, DataSourceSpec } from '../../src/spec.mjs';
import { StorageEngine } from '../../src/engine.mjs';

export function tmpDir(prefix = 'intel-store-') {
  return mkdtempSync(join(tmpdir(), prefix));
}

export function rmTmp(dir) {
  if (existsSync(dir)) rmSync(dir, { recursive: true, force: true });
}

export function makeEngine(specs, { timezone = 'UTC' } = {}) {
  const baseDir = tmpDir();
  const registry = new DataSourceRegistry();
  for (const s of specs) {
    registry.register(s instanceof DataSourceSpec ? s : new DataSourceSpec(s));
  }
  const engine = new StorageEngine({ baseDir, registry, timezone });
  return { engine, baseDir, cleanup: () => rmTmp(baseDir) };
}
