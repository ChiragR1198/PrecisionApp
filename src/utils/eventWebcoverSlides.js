/**
 * Dashboard hero carousel URLs come from the API field `webcover_slides` (string[]).
 *
 * Source of truth (filenames & category rules): edit backend only —
 * `precision-backend/application/config/event_webcover.php`
 *
 * Do not hardcode image lists here.
 */

import { resolveMediaUrl } from './resolveMediaUrl';

/**
 * @param {unknown} raw — `event.webcover_slides` from mobile events API
 * @returns {string[]}
 */
export function normalizeWebcoverSlideUris(raw) {
  if (!Array.isArray(raw)) return [];
  const out = [];
  for (const item of raw) {
    if (item == null || item === '') continue;
    const u = resolveMediaUrl(String(item).trim());
    if (u) out.push(u);
  }
  return out;
}
