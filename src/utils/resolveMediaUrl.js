import { API_BASE_URL } from '../config/api';

/**
 * Origin of the site that serves /assets (same server family as the mobile API).
 * Fixes JSON that contains localhost, LAN IPs, or another env host so <Image> can load on device.
 */
function getApiSiteOrigin() {
  try {
    const u = new URL(API_BASE_URL);
    return u.origin;
  } catch {
    return '';
  }
}

/**
 * Encode each pathname segment so characters like `*` in uploaded filenames (e.g. 450*600.png)
 * do not break React Native <Image> requests.
 */
function finalizeHttpUrlPathEncoding(maybeUrl) {
  if (maybeUrl == null || maybeUrl === '') return maybeUrl;
  const u = String(maybeUrl).trim();
  if (!/^https?:\/\//i.test(u)) return u;
  try {
    const parsed = new URL(u);
    const encodedPath = parsed.pathname
      .split('/')
      .map((seg) => {
        if (!seg) return seg;
        try {
          return encodeURIComponent(decodeURIComponent(seg));
        } catch {
          return encodeURIComponent(seg);
        }
      })
      .join('/');
    parsed.pathname = encodedPath;
    return parsed.href;
  } catch {
    return u;
  }
}

/**
 * @param {string|null|undefined} url
 * @returns {string|null}
 */
export function resolveMediaUrl(url) {
  if (url == null || url === '') return null;
  let s = String(url).trim();
  if (!s || s.toLowerCase() === 'null') return null;

  const origin = getApiSiteOrigin();
  if (!origin) return finalizeHttpUrlPathEncoding(s);

  // Relative to site root (some APIs omit domain)
  if (s.startsWith('/')) {
    return finalizeHttpUrlPathEncoding(`${origin}${s}`);
  }

  // Bare path without leading slash (e.g. assets/uploads/...)
  if (!/^https?:\/\//i.test(s) && /assets\/uploads|uploads\//i.test(s)) {
    return finalizeHttpUrlPathEncoding(`${origin}/${s.replace(/^\/+/, '')}`);
  }

  try {
    const parsed = new URL(s);
    const apiOrigin = new URL(origin);

    const isLocal =
      parsed.hostname === 'localhost' ||
      parsed.hostname === '127.0.0.1' ||
      /^192\.168\.\d+\.\d+$/.test(parsed.hostname) ||
      /^10\.\d+\.\d+\.\d+$/.test(parsed.hostname);

    // Same host: upgrade http -> https when API is https (iOS ATS)
    if (parsed.hostname === apiOrigin.hostname) {
      if (apiOrigin.protocol === 'https:' && parsed.protocol === 'http:') {
        return finalizeHttpUrlPathEncoding(
          `https://${parsed.host}${parsed.pathname}${parsed.search || ''}`
        );
      }
      return finalizeHttpUrlPathEncoding(s);
    }

    // Different host (wrong env in JSON): keep path + query on API origin
    if (isLocal || parsed.hostname !== apiOrigin.hostname) {
      const path = `${parsed.pathname}${parsed.search || ''}`;
      if (path && path !== '/') {
        return finalizeHttpUrlPathEncoding(`${origin}${path.startsWith('/') ? path : `/${path}`}`);
      }
    }

    return finalizeHttpUrlPathEncoding(s);
  } catch {
    return finalizeHttpUrlPathEncoding(s);
  }
}
