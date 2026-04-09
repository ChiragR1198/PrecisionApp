/**
 * Split plain text into alternating text / URL segments for chat bubbles.
 * Matches `http(s)://...` and `www....` until whitespace.
 */
export function splitMessageByUrls(text) {
  const s = String(text ?? '');
  if (!s) return [{ type: 'text', value: '' }];

  const re = /((?:https?:\/\/|www\.)[^\s<>[\]{}'"،]+)/gi;
  const segments = [];
  let lastIndex = 0;
  let m;

  while ((m = re.exec(s)) !== null) {
    if (m.index > lastIndex) {
      segments.push({ type: 'text', value: s.slice(lastIndex, m.index) });
    }
    const raw = m[1];
    let openHref = raw.replace(/[.,;:!?)\]]+$/, '');
    if (!openHref) openHref = raw;
    if (/^www\./i.test(openHref)) {
      openHref = `https://${openHref}`;
    }
    segments.push({ type: 'url', value: raw, href: openHref });
    lastIndex = m.index + raw.length;
  }

  if (lastIndex < s.length) {
    segments.push({ type: 'text', value: s.slice(lastIndex) });
  }

  if (segments.length === 0) {
    return [{ type: 'text', value: s }];
  }
  return segments;
}
