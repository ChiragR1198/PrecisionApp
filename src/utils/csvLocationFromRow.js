/**
 * CSV "Location" column: sponsors table uses `address`; delegates use `country` (and often `state`).
 * API shapes vary — read from list row and optional `raw` payload.
 */
export function csvLocationFromRow(item) {
  if (!item || typeof item !== 'object') return '';
  const raw = item.raw && typeof item.raw === 'object' ? item.raw : {};
  // Use || not ?? so empty string on the row does not block `raw.address` (API stores address on raw).
  const addr = String(
    item.address ||
      item.location ||
      raw.address ||
      raw.Address ||
      raw.location ||
      raw.sponsor_address ||
      ''
  ).trim();
  if (addr) return addr;
  const state = String(item.state || raw.state || '').trim();
  const country = String(item.country || raw.country || '').trim();
  return [state, country].filter(Boolean).join(', ') || '';
}
