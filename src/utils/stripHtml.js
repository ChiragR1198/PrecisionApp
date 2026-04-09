/**
 * Rough HTML → plain text for in-app display (API descriptions often contain `<p>`, `<br>`, etc.).
 */
export function stripHtml(html) {
  if (html == null) return '';
  let s = String(html);
  s = s.replace(/<br\s*\/?>/gi, '\n');
  s = s.replace(/<\/p>/gi, '\n\n');
  s = s.replace(/<[^>]+>/g, '');
  s = s.replace(/&nbsp;/g, ' ');
  s = s.replace(/&amp;/g, '&');
  s = s.replace(/&lt;/g, '<');
  s = s.replace(/&gt;/g, '>');
  s = s.replace(/&quot;/g, '"');
  s = s.replace(/\n{3,}/g, '\n\n');
  return s.trim();
}
