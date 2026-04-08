/**
 * Compare dotted semver-like strings (major.minor.patch). Extra segments ignored.
 */

export function parseSemverParts(v) {
  const s = String(v ?? '0').trim();
  const m = s.match(/^(\d+)(?:\.(\d+))?(?:\.(\d+))?/);
  if (!m) return [0, 0, 0];
  return [
    parseInt(m[1], 10) || 0,
    parseInt(m[2], 10) || 0,
    parseInt(m[3], 10) || 0,
  ];
}

/** True if current is strictly older than minimum (e.g. 1.0.6 < 1.0.7). */
export function isVersionBelow(current, minimum) {
  const a = parseSemverParts(current);
  const b = parseSemverParts(minimum);
  for (let i = 0; i < 3; i++) {
    if (a[i] < b[i]) return true;
    if (a[i] > b[i]) return false;
  }
  return false;
}
