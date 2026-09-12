import { cache } from 'react';
import { createClient } from '@/lib/supabase/server';
import type { SubjectOverview, Subject } from '@/lib/supabase/database.types';

/** All subjects with their counts, in one query (see migration 0011). */
export async function listSubjects(
  { includeArchived = false } = {},
): Promise<SubjectOverview[]> {
  const supabase = await createClient();
  let query = supabase.from('subject_overview').select('*');
  if (!includeArchived) query = query.is('archived_at', null);

  const { data, error } = await query.order('name', { ascending: true });

  if (error) {
    console.error('listSubjects failed:', error.message);
    return [];
  }
  return data ?? [];
}

/**
 * Minimal list for pickers -- no counts needed.
 *
 * Cached per request: the app shell loads it for Quick Capture on every page,
 * and Tasks, Resources, Voice and Class Mode each ask for it again. Without
 * this that is two identical round trips per navigation.
 */
export const listSubjectOptions = cache(async (): Promise<
  Pick<Subject, 'id' | 'name' | 'color'>[]
> => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('subjects')
    .select('id,name,color')
    .is('archived_at', null)
    .order('name', { ascending: true });

  if (error) {
    console.error('listSubjectOptions failed:', error.message);
    return [];
  }
  return data ?? [];
});

/** Cached per request: generateMetadata and the page itself both need it. */
export const getSubject = cache(async (id: string): Promise<SubjectOverview | null> => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('subject_overview')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error) {
    console.error('getSubject failed:', error.message);
    return null;
  }
  return data;
});
