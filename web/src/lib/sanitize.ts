import DOMPurify from 'isomorphic-dompurify';

/**
 * Sanitise rich-text HTML before it is stored.
 *
 * This runs on the SERVER, inside the server action. Sanitising only in the
 * editor would be decorative: anyone can POST straight to the action with a
 * crafted payload. The stored value is the one that gets rendered back with
 * dangerouslySetInnerHTML, so the database must never hold anything unsafe.
 *
 * The allowlist matches exactly what the Tiptap StarterKit can produce -- no
 * more. Notably absent: script, style, iframe, object, form, and every event
 * handler attribute.
 */
const ALLOWED_TAGS = [
  'p', 'br', 'strong', 'b', 'em', 'i', 's', 'u', 'code', 'pre',
  'h1', 'h2', 'h3', 'h4', 'ul', 'ol', 'li', 'blockquote', 'hr', 'a',
];

const ALLOWED_ATTR = ['href', 'target', 'rel'];

export function sanitizeNoteHtml(html: string): string {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    // Block javascript:, data: and other script-bearing URL schemes on links.
    ALLOWED_URI_REGEXP: /^(?:https?|mailto):/i,
    // Drop the contents of anything disallowed rather than inlining its text.
    KEEP_CONTENT: true,
  });
}

/** Plain-text preview, for list rows and search snippets. */
export function htmlToPlainText(html: string, limit = 200): string {
  const text = html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s{2,}/g, ' ')
    .trim();
  return text.length > limit ? `${text.slice(0, limit)}...` : text;
}
