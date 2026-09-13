'use server';

import { revalidatePath } from 'next/cache';
import { createClient, getCurrentUser } from '@/lib/supabase/server';
import { SESSION_EXPIRED, dbFailure, type ActionResult } from './result';
import type { ResourceType } from '@/lib/supabase/database.types';
import { logActivity } from './activity';
import { withResult } from './with-result';

const BUCKET = 'resources';

function revalidateResourceViews(subjectId?: string | null) {
  revalidatePath('/resources');
  revalidatePath('/home');
  if (subjectId) revalidatePath(`/subjects/${subjectId}`);
}

/**
 * Record an already-uploaded object.
 *
 * The browser uploads first (so it can show real progress), then calls this.
 * If the metadata write fails the object is deleted again -- otherwise the
 * bucket accumulates files no row points at, which no one can see or clean up
 * (section 39).
 */
export async function registerResource(input: {
  title: string;
  filePath: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  resourceType: ResourceType;
  subjectId?: string | null;
  description?: string | null;
  tags?: string[];
}): Promise<ActionResult<{ id: string }>> {
  return withResult('save that file', async () => {
    const user = await getCurrentUser();
    if (!user) return { ok: false, error: SESSION_EXPIRED };
    const supabase = await createClient();

    // The path must sit inside this user's own tree. Storage RLS enforces this
    // too, but a mismatch here means something is wrong and the row should not
    // be written at all.
    if (!input.filePath.startsWith(`users/${user.id}/`)) {
      return { ok: false, error: 'That upload location is not valid.' };
    }

    const { data, error } = await supabase
      .from('resources')
      .insert({
        user_id: user.id,
        title: input.title.trim().slice(0, 300) || input.fileName,
        file_path: input.filePath,
        file_name: input.fileName,
        file_size: input.fileSize,
        mime_type: input.mimeType,
        resource_type: input.resourceType,
        subject_id: input.subjectId || null,
        description: input.description?.trim() || null,
        tags: input.tags ?? [],
      })
      .select('id,subject_id')
      .single();

    if (error) {
      console.error('registerResource failed, removing orphaned object:', error.message);
      const { error: cleanupError } = await supabase.storage.from(BUCKET).remove([input.filePath]);
      if (cleanupError) {
        // Both failed. Say so rather than implying the upload simply did not happen.
        console.error('Orphan cleanup ALSO failed for', input.filePath, cleanupError.message);
        return {
          ok: false,
          error: 'The file uploaded but could not be saved to your library. Please try again.',
        };
      }
      return dbFailure('save that file', error.message);
    }

    await logActivity(supabase, {
      user_id: user.id,
      kind: 'uploaded',
      entity_type: 'resource',
      entity_id: data.id,
      subject_id: data.subject_id,
      entity_title: input.title.trim() || input.fileName,
    });

    revalidateResourceViews(data.subject_id);
    return { ok: true, data: { id: data.id } };
  });
}

export async function createLinkResource(input: {
  title: string;
  url: string;
  subjectId?: string | null;
  description?: string | null;
  tags?: string[];
}): Promise<ActionResult<{ id: string }>> {
  return withResult('save that link', async () => {
    const user = await getCurrentUser();
    if (!user) return { ok: false, error: SESSION_EXPIRED };

    const url = input.url.trim();
    if (!/^https?:\/\/.+/i.test(url)) {
      return { ok: false, error: 'Enter a full link starting with http:// or https://' };
    }
    if (!input.title.trim()) return { ok: false, error: 'Give the link a title.' };

    const supabase = await createClient();
    const { data, error } = await supabase
      .from('resources')
      .insert({
        user_id: user.id,
        title: input.title.trim().slice(0, 300),
        external_url: url,
        resource_type: 'link',
        subject_id: input.subjectId || null,
        description: input.description?.trim() || null,
        tags: input.tags ?? [],
      })
      .select('id,subject_id')
      .single();

    if (error) {
      console.error('createLinkResource failed:', error.message);
      return { ok: false, error: 'Could not save that link.' };
    }

    revalidateResourceViews(data.subject_id);
    return { ok: true, data: { id: data.id } };
  });
}

export async function updateResource(
  id: string,
  patch: { title?: string; description?: string | null; subjectId?: string | null; tags?: string[] },
): Promise<ActionResult> {
  return withResult('save that file', async () => {
    if (!(await getCurrentUser())) return { ok: false, error: SESSION_EXPIRED };

    if (patch.title !== undefined && !patch.title.trim()) {
      return { ok: false, error: 'Give the file a name.' };
    }

    const supabase = await createClient();
    const { data, error } = await supabase
      .from('resources')
      .update({
        ...(patch.title !== undefined && { title: patch.title.trim().slice(0, 300) }),
        ...(patch.description !== undefined && { description: patch.description?.trim() || null }),
        ...(patch.subjectId !== undefined && { subject_id: patch.subjectId || null }),
        ...(patch.tags !== undefined && { tags: patch.tags }),
      })
      .eq('id', id)
      .select('subject_id')
      .single();

    if (error) {
      console.error('updateResource failed:', error.message);
      return { ok: false, error: 'Could not save those changes.' };
    }

    revalidateResourceViews(data.subject_id);
    return { ok: true, data: undefined };
  });
}

/**
 * Delete a resource and its stored object.
 *
 * The row is removed first, deliberately. If the object delete then fails the
 * result is an orphaned file: invisible to the student and recoverable by a
 * sweeper. The opposite order risks the worse outcome -- a row still listed in
 * the library whose file 404s when opened.
 */
export async function deleteResource(id: string): Promise<ActionResult> {
  return withResult('delete that file', async () => {
    const user = await getCurrentUser();
    if (!user) return { ok: false, error: SESSION_EXPIRED };
    const supabase = await createClient();

    const { data: existing, error: readError } = await supabase
      .from('resources')
      .select('title,file_path,subject_id')
      .eq('id', id)
      .single();

    if (readError || !existing) {
      return { ok: false, error: 'That file no longer exists.' };
    }

    const { error: deleteError } = await supabase.from('resources').delete().eq('id', id);
    if (deleteError) {
      console.error('deleteResource row delete failed:', deleteError.message);
      return { ok: false, error: 'Could not delete that file.' };
    }

    if (existing.file_path) {
      const { error: storageError } = await supabase.storage
        .from(BUCKET)
        .remove([existing.file_path]);
      if (storageError) {
        // The student's view is already correct; log the orphan for cleanup.
        console.error('ORPHANED STORAGE OBJECT', existing.file_path, storageError.message);
      }
    }

    await logActivity(supabase, {
      user_id: user.id,
      kind: 'deleted',
      entity_type: 'resource',
      entity_id: null,
      subject_id: existing.subject_id,
      entity_title: existing.title,
    });

    revalidateResourceViews(existing.subject_id);
    return { ok: true, data: undefined };
  });
}

/**
 * Short-lived signed URL for preview or download.
 *
 * Buckets are private, so this is the only way to read an object. RLS scopes
 * the row lookup to the caller, so a signed URL can only ever be minted for a
 * file the caller owns.
 */
export async function getResourceUrl(
  id: string,
  { download = false }: { download?: boolean } = {},
): Promise<ActionResult<{ url: string }>> {
  return withResult('open that file', async () => {
    if (!(await getCurrentUser())) return { ok: false, error: SESSION_EXPIRED };
    const supabase = await createClient();

    const { data: resource, error } = await supabase
      .from('resources')
      .select('file_path,file_name,external_url')
      .eq('id', id)
      .single();

    if (error || !resource) return { ok: false, error: 'That file could not be found.' };
    if (resource.external_url) return { ok: true, data: { url: resource.external_url } };
    if (!resource.file_path) return { ok: false, error: 'That resource has no file attached.' };

    const { data: signed, error: signError } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(resource.file_path, 300, // five minutes is plenty to open or save
        download ? { download: resource.file_name ?? true } : undefined);

    if (signError || !signed) {
      console.error('createSignedUrl failed:', signError?.message);
      return dbFailure('open that file', signError?.message);
    }

    return { ok: true, data: { url: signed.signedUrl } };
  });
}
