'use server';

import { createClient } from '@/lib/supabase/server';
import type { SearchHit } from '@/lib/supabase/database.types';

export type SearchResult = {
  hits: SearchHit[];
  error: string | null;
};

/**
 * Global search across subjects, notes, resources, tasks and voice transcripts.
 *
 * Calls the search_all RPC, which is SECURITY INVOKER: results are scoped to the
 * caller by RLS rather than by a filter we have to remember to add here.
 */
export async function searchEverything(
  query: string,
  options: { types?: string[]; subjectId?: string } = {},
): Promise<SearchResult> {
  const q = query.trim();
  if (q.length < 2) return { hits: [], error: null };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc('search_all', {
    q,
    p_types: options.types?.length ? options.types : undefined,
    p_subject_id: options.subjectId || undefined,
    p_limit: 40,
  });

  if (error) {
    console.error('Search failed:', error.message);
    return { hits: [], error: 'Search is unavailable right now. Try again in a moment.' };
  }

  return { hits: data ?? [], error: null };
}
