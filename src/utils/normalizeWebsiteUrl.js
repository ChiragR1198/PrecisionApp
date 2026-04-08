/**
 * @param {string|null|undefined} url
 * @returns {string|null} Safe https URL for Linking.openURL, or null if empty/invalid
 */
export function normalizeWebsiteUrl(url) {
  if (url == null) return null;
  const s = String(url).trim();
  if (!s || s.toLowerCase() === 'null') return null;
  if (/^https?:\/\//i.test(s)) return s;
  return `https://${s.replace(/^\/+/, '')}`;
}

/**
 * When `company_website_url` is empty, derive https://{domain} from a corporate email.
 * Skips common personal mail hosts.
 * @param {string|null|undefined} email
 * @returns {string|null}
 */
export function inferWebsiteUrlFromEmail(email) {
  if (email == null) return null;
  const s = String(email).trim();
  const at = s.indexOf('@');
  if (at < 0) return null;
  let domain = s.slice(at + 1).toLowerCase().trim();
  if (!domain) return null;
  const noWww = domain.replace(/^www\./, '');
  if (
    /^(gmail|googlemail|yahoo|hotmail|outlook|live|icloud|aol|msn|protonmail|pm\.me|me\.com)(\.|$)/i.test(
      noWww
    )
  ) {
    return null;
  }
  return `https://${noWww}`;
}
