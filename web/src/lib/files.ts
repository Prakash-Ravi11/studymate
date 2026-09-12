import type { ResourceType } from '@/lib/supabase/database.types';

/** Mirrors the allowed_mime_types on the `resources` bucket (migration 0008). */
export const ALLOWED_MIME = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.oasis.opendocument.text',
  'application/vnd.oasis.opendocument.spreadsheet',
  'application/rtf',
  'text/plain',
  'text/csv',
  'text/markdown',
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
  'image/heic',
]);

/** Matches the bucket's file_size_limit; checked here so the student gets a
 *  sentence instead of an opaque 413 from storage. */
export const MAX_FILE_BYTES = 50 * 1024 * 1024;

export function resourceTypeFor(mime: string, fileName: string): ResourceType {
  if (mime === 'application/pdf') return 'pdf';
  if (mime.startsWith('image/')) return 'image';
  if (mime.startsWith('audio/')) return 'audio';
  if (mime.startsWith('video/')) return 'video';
  if (mime.includes('presentation') || mime.includes('powerpoint')) return 'presentation';
  if (mime.includes('spreadsheet') || mime.includes('excel') || mime === 'text/csv') return 'spreadsheet';
  if (mime.includes('word') || mime.includes('opendocument.text') || mime === 'application/rtf')
    return 'document';
  if (mime.startsWith('text/')) return 'document';

  // Fall back to the extension when the browser reports a useless MIME type.
  const ext = fileName.split('.').pop()?.toLowerCase();
  if (ext === 'pdf') return 'pdf';
  if (ext && ['png', 'jpg', 'jpeg', 'gif', 'webp', 'heic'].includes(ext)) return 'image';
  if (ext && ['ppt', 'pptx'].includes(ext)) return 'presentation';
  if (ext && ['xls', 'xlsx', 'csv'].includes(ext)) return 'spreadsheet';
  if (ext && ['doc', 'docx', 'odt', 'rtf', 'txt', 'md'].includes(ext)) return 'document';
  return 'other';
}

/**
 * Make a filename safe to use as a storage object key.
 *
 * Strips path separators and traversal sequences (a name like
 * "../../other-user/secret.pdf" must never influence the key), collapses unsafe
 * characters, and caps the length. The RLS policy pins the user segment
 * regardless, but a clean key is the first line of defence, not the last.
 */
export function safeFileName(name: string): string {
  const base = name.split(/[/\\]/).pop() ?? 'file';
  const cleaned = base
    .replace(/[^\w.\- ]+/g, '_')
    .replace(/\.{2,}/g, '.')
    .replace(/^\.+/, '')
    .trim()
    .slice(0, 120);
  return cleaned || 'file';
}

export function validateFile(file: File): string | null {
  if (file.size === 0) return `"${file.name}" is empty.`;
  if (file.size > MAX_FILE_BYTES) {
    return `"${file.name}" is larger than 50 MB. Try compressing it or linking to it instead.`;
  }
  // Some browsers report an empty type for less common formats; fall back to
  // the extension check inside resourceTypeFor rather than rejecting outright.
  if (file.type && !ALLOWED_MIME.has(file.type)) {
    return `"${file.name}" is a ${file.type} file, which StudyMate does not accept.`;
  }
  return null;
}

/** Storage key: users/{uid}/subjects/{sid}/resources/{uuid}-{name} */
export function buildResourcePath(userId: string, subjectId: string | null, fileName: string) {
  const unique = crypto.randomUUID();
  const scope = subjectId ? `subjects/${subjectId}` : 'unfiled';
  return `users/${userId}/${scope}/resources/${unique}-${safeFileName(fileName)}`;
}
