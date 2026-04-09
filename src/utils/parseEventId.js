/**
 * Coerce user/API event ids to a single numeric id for query params.
 * DB often stores multi-event users as comma-separated strings (e.g. "27,44").
 */
export function normalizeEventIdForApi(raw) {
  if (raw == null || raw === '') return null;
  if (typeof raw === 'number' && Number.isFinite(raw) && raw > 0) return raw;
  const s = String(raw).trim();
  if (!s) return null;
  const first = s.includes(',') ? s.split(',')[0].trim() : s;
  const n = Number(first);
  return Number.isFinite(n) && n > 0 ? n : null;
}
