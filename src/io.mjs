import {
  existsSync, readFileSync, writeFileSync, appendFileSync,
  mkdirSync, readdirSync, statSync, unlinkSync, renameSync,
} from 'node:fs';
import { dirname, basename } from 'node:path';

const DEFAULT_LOGGER = {
  warn(msg) { console.error(msg); },
  error(msg) { console.error(msg); },
};

/**
 * @param {{warn?: Function, error?: Function} | null} [logger]
 */
export function makeLogger(logger) {
  if (!logger) return DEFAULT_LOGGER;
  return {
    warn: typeof logger.warn === 'function' ? logger.warn.bind(logger) : DEFAULT_LOGGER.warn,
    error: typeof logger.error === 'function' ? logger.error.bind(logger) : DEFAULT_LOGGER.error,
  };
}

/** @param {string} dirPath */
export function ensureDir(dirPath) {
  mkdirSync(dirPath, { recursive: true });
}

/**
 * Atomic JSON write via temp file + rename (same directory => atomic on POSIX).
 * @param {string} filepath
 * @param {*} data
 */
export function atomicWriteJson(filepath, data) {
  ensureDir(dirname(filepath));
  const tempFile = filepath + '.tmp';
  writeFileSync(tempFile, JSON.stringify(data, null, 2), 'utf-8');
  renameSync(tempFile, filepath);
}

/**
 * @param {string} filepath
 * @returns {*|null}
 */
export function readJson(filepath) {
  if (!existsSync(filepath)) return null;
  try {
    return JSON.parse(readFileSync(filepath, 'utf-8'));
  } catch {
    return null;
  }
}

/**
 * @param {string} filepath
 * @param {*} record
 * @param {{warn: Function, error: Function}} [logger]
 */
export function appendJsonl(filepath, record, logger = DEFAULT_LOGGER) {
  ensureDir(dirname(filepath));
  try {
    appendFileSync(filepath, JSON.stringify(record) + '\n', 'utf-8');
  } catch (e) {
    logger.error(`[js-intel-store] append JSONL failed (${basename(filepath)}): ${e.message}`);
  }
}

/**
 * @param {string} filepath
 * @param {Iterable<*>} records
 * @param {{warn: Function, error: Function}} [logger]
 * @returns {number} number of lines actually appended
 */
export function appendJsonlBatch(filepath, records, logger = DEFAULT_LOGGER) {
  const arr = [...records];
  if (!arr.length) return 0;
  ensureDir(dirname(filepath));
  try {
    const lines = arr.map(r => JSON.stringify(r)).join('\n') + '\n';
    appendFileSync(filepath, lines, 'utf-8');
    return arr.length;
  } catch (e) {
    logger.error(`[js-intel-store] append JSONL batch failed (${basename(filepath)}): ${e.message}`);
    return 0;
  }
}

/**
 * @param {string} filepath
 * @param {number|null} [limit] return last N records when set
 * @returns {Object[]}
 */
export function readJsonl(filepath, limit = null) {
  if (!existsSync(filepath)) return [];
  const records = [];
  try {
    const content = readFileSync(filepath, 'utf-8');
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      try { records.push(JSON.parse(trimmed)); } catch { /* skip malformed */ }
    }
  } catch { /* read error */ }
  if (limit && records.length > limit) return records.slice(-limit);
  return records;
}

/**
 * Rewrite a JSONL file by replacing its full content. Atomic via temp+rename.
 * @param {string} filepath
 * @param {Iterable<*>} records
 * @returns {boolean} success
 */
export function rewriteJsonl(filepath, records) {
  ensureDir(dirname(filepath));
  const tempFile = filepath + '.tmp';
  try {
    const arr = [...records];
    const content = arr.length ? arr.map(r => JSON.stringify(r)).join('\n') + '\n' : '';
    writeFileSync(tempFile, content, 'utf-8');
    renameSync(tempFile, filepath);
    return true;
  } catch {
    try { unlinkSync(tempFile); } catch { /* ignore */ }
    return false;
  }
}

/**
 * Delete files older than keepDays in dirPath. Filenames must match YYYY-MM-DD.* prefix.
 * @param {string} dirPath
 * @param {number} keepDays
 * @param {{warn: Function, error: Function}} [logger]
 * @returns {number} count of deleted files
 */
export function cleanupOldDateFiles(dirPath, keepDays, logger = DEFAULT_LOGGER) {
  if (!existsSync(dirPath)) return 0;
  const cutoff = Date.now() - keepDays * 86400000;
  let deleted = 0;
  for (const name of readdirSync(dirPath)) {
    const m = name.match(/^(\d{4}-\d{2}-\d{2})/);
    if (!m) continue;
    const fileDate = Date.parse(m[1] + 'T00:00:00Z');
    if (Number.isNaN(fileDate) || fileDate >= cutoff) continue;
    try {
      unlinkSync(`${dirPath}/${name}`);
      deleted++;
    } catch (e) {
      logger.warn(`[js-intel-store] failed to delete ${name}: ${e.message}`);
    }
  }
  return deleted;
}

export {
  existsSync, readFileSync, writeFileSync, appendFileSync,
  mkdirSync, readdirSync, statSync, unlinkSync, renameSync,
};
