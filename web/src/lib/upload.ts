'use client';

import { createClient } from '@/lib/supabase/client';

export type UploadProgress = { loaded: number; total: number; percent: number };

/**
 * Upload straight to Supabase Storage with real progress.
 *
 * supabase-js's storage.upload() gives no progress events, so this posts to the
 * storage REST endpoint with XMLHttpRequest instead -- the one API that reports
 * upload progress. A fake progress animation would be exactly the kind of
 * pretend functionality this product is not allowed to ship.
 */
export async function uploadToStorage(
  bucket: string,
  path: string,
  file: File,
  onProgress?: (p: UploadProgress) => void,
  signal?: AbortSignal,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = createClient();

  let token: string | undefined;
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    token = session?.access_token;
  } catch (cause) {
    // A rejected lookup must not throw out of here: the caller marks a job
    // 'uploading' before calling, and an exception would strand that row on a
    // progress bar that never moves.
    console.error('getSession() threw before upload:', cause);
  }

  if (!token) return { ok: false, error: 'Your session expired. Sign in again and retry.' };

  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const url = `${base}/storage/v1/object/${bucket}/${path}`;

  return new Promise((resolve) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', url, true);
    xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    xhr.setRequestHeader('x-upsert', 'false');
    if (file.type) xhr.setRequestHeader('Content-Type', file.type);

    xhr.upload.onprogress = (e) => {
      if (!e.lengthComputable) return;
      onProgress?.({
        loaded: e.loaded,
        total: e.total,
        percent: Math.round((e.loaded / e.total) * 100),
      });
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) return resolve({ ok: true });
      if (xhr.status === 413) {
        return resolve({ ok: false, error: 'That file is too large for the 50 MB limit.' });
      }
      if (xhr.status === 409) {
        return resolve({ ok: false, error: 'A file already exists at that location.' });
      }
      if (xhr.status === 403 || xhr.status === 401) {
        return resolve({ ok: false, error: 'You are not allowed to upload there. Try signing in again.' });
      }
      resolve({ ok: false, error: `Upload failed (${xhr.status}). Please try again.` });
    };

    xhr.onerror = () =>
      resolve({ ok: false, error: 'Upload failed — check your connection and try again.' });
    xhr.onabort = () => resolve({ ok: false, error: 'Upload cancelled.' });

    // Without this an XHR whose connection dies mid-transfer never fires any
    // handler, so the promise never settles and the progress bar sits at
    // whatever percent it reached. Generous, because a big PDF on campus wifi
    // is legitimately slow -- this is for a dead connection, not a slow one.
    xhr.timeout = 5 * 60_000;
    xhr.ontimeout = () =>
      resolve({ ok: false, error: 'Upload timed out. Check your connection and try again.' });

    signal?.addEventListener('abort', () => xhr.abort(), { once: true });

    xhr.send(file);
  });
}
