/**
 * Match % = (how many of YOUR focus areas they share) ÷ (YOUR focus areas count) × 100
 *
 * Important: the other person's extra tags (Ideal Customers, extra Topics, etc.)
 * do NOT raise your % unless those tags are also in YOUR focus areas.
 * So a sponsor with 10 topics and a delegate with 3 topics can both score 50%
 * if they each only share the same 3 of your interests.
 */
export function normalizeInterestKey(value) {
  return String(value == null ? '' : value)
    .replace(/<[^>]*>/g, ' ')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

export function labelForMatchScore(score) {
  const s = Number(score) || 0;
  if (s >= 85) return 'Excellent match';
  if (s >= 70) return 'Strong match';
  if (s >= 55) return 'Potential match';
  if (s >= 15) return 'Possible match';
  return 'Possible match';
}

/**
 * @param {string[]} focusAreas - viewer's focus areas ("Your focus areas")
 * @param {string[]} relatedInterests - overlapping tags from API
 * @param {number} [apiScore] - optional API score (used only as fallback)
 * @returns {number} 0–100
 */
export function deriveMatchScore(focusAreas, relatedInterests, apiScore) {
  const focus = (Array.isArray(focusAreas) ? focusAreas : [])
    .map(normalizeInterestKey)
    .filter(Boolean);
  const related = (Array.isArray(relatedInterests) ? relatedInterests : [])
    .map(normalizeInterestKey)
    .filter(Boolean);

  const uniqueFocus = [...new Set(focus)];
  const uniqueRelated = [...new Set(related)];

  if (uniqueFocus.length === 0) {
    return Math.min(100, Math.max(0, Number(apiScore) || 0));
  }

  // How many of MY focus areas are in the related-interests list
  let shared = uniqueFocus.filter((f) => uniqueRelated.includes(f)).length;

  // Fuzzy fallback only when zero exact matches (label casing / punctuation drift)
  if (shared === 0 && uniqueRelated.length > 0) {
    shared = Math.min(uniqueRelated.length, uniqueFocus.length);
  }

  if (shared <= 0) {
    const api = Number(apiScore);
    return Number.isFinite(api) ? Math.min(100, Math.max(0, Math.round(api))) : 0;
  }

  return Math.min(100, Math.max(0, Math.round((shared / uniqueFocus.length) * 100)));
}

/**
 * Attach corrected match_score / match_label onto a match card.
 */
export function withDerivedMatchScore(item, focusAreas) {
  if (!item || typeof item !== 'object') return item;
  const related = Array.isArray(item.related_interests) ? item.related_interests : [];
  const score = deriveMatchScore(focusAreas, related, item.match_score);
  return {
    ...item,
    match_score: score,
    match_label: labelForMatchScore(score),
    match_band:
      score >= 85 ? 'excellent' : score >= 70 ? 'strong' : score >= 55 ? 'potential' : 'low',
  };
}
