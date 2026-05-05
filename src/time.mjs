/**
 * Timezone-aware date helpers used by daily_jsonl partitioning and ISO timestamps.
 * Every function takes a timezone parameter so callers (or StorageEngine) decide
 * which IANA zone to use, rather than relying on system-local time.
 */

const ISO_OFFSET_FORMATTERS = new Map();

/**
 * @param {string} timeZone IANA timezone name, e.g. 'Asia/Shanghai', 'UTC', 'America/Los_Angeles'
 * @param {Date} [date]
 * @returns {string} YYYY-MM-DD in that timezone
 */
export function todayInTz(timeZone = 'UTC', date = new Date()) {
  return date.toLocaleDateString('sv-SE', { timeZone });
}

/**
 * @param {number} daysAgo
 * @param {string} [timeZone]
 * @returns {string} YYYY-MM-DD in that timezone
 */
export function dateStrDaysAgo(daysAgo, timeZone = 'UTC') {
  const d = new Date(Date.now() - daysAgo * 86400000);
  return todayInTz(timeZone, d);
}

/**
 * Compute a fixed UTC offset (in minutes) for a given IANA timezone at a given instant.
 * Uses Intl APIs; works for all standard zones without bringing in a full tz library.
 * @param {string} timeZone
 * @param {Date} date
 * @returns {number} offset in minutes east of UTC
 */
function tzOffsetMinutes(timeZone, date) {
  let fmt = ISO_OFFSET_FORMATTERS.get(timeZone);
  if (!fmt) {
    fmt = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hour12: false,
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    });
    ISO_OFFSET_FORMATTERS.set(timeZone, fmt);
  }
  const parts = fmt.formatToParts(date);
  const map = {};
  for (const p of parts) {
    if (p.type !== 'literal') map[p.type] = p.value;
  }
  const hour = map.hour === '24' ? '00' : map.hour;
  const asUtc = Date.UTC(
    Number(map.year), Number(map.month) - 1, Number(map.day),
    Number(hour), Number(map.minute), Number(map.second),
  );
  return Math.round((asUtc - date.getTime()) / 60000);
}

/**
 * @param {string} [timeZone]
 * @param {Date} [date]
 * @returns {string} ISO 8601 with offset, e.g. 2026-05-05T16:30:00+08:00
 */
export function nowInTz(timeZone = 'UTC', date = new Date()) {
  const offsetMin = tzOffsetMinutes(timeZone, date);
  const sign = offsetMin >= 0 ? '+' : '-';
  const abs = Math.abs(offsetMin);
  const oh = String(Math.floor(abs / 60)).padStart(2, '0');
  const om = String(abs % 60).padStart(2, '0');

  const shifted = new Date(date.getTime() + offsetMin * 60000);
  const y = shifted.getUTCFullYear();
  const mo = String(shifted.getUTCMonth() + 1).padStart(2, '0');
  const d = String(shifted.getUTCDate()).padStart(2, '0');
  const h = String(shifted.getUTCHours()).padStart(2, '0');
  const mi = String(shifted.getUTCMinutes()).padStart(2, '0');
  const s = String(shifted.getUTCSeconds()).padStart(2, '0');
  return `${y}-${mo}-${d}T${h}:${mi}:${s}${sign}${oh}:${om}`;
}
