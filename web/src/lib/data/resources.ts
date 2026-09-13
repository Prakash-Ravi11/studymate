import { createClient } from '@/lib/supabase/server';
import type { Resource, ResourceType } from '@/lib/supabase/database.types';

export type ResourceListItem = Pick<
  Resource,
  'id' | 'title' | 'description' | 'resource_type' | 'file_name' | 'file_size'
  | 'mime_type' | 'external_url' | 'subject_id' | 'tags' | 'created_at'
> & { subjects: { name: string; color: string } | null };

export async function listResources(
  options: { subjectId?: string; type?: ResourceType; q?: string } = {},
): Promise<ResourceListItem[]> {
  const supabase = await createClient();
  let query = supabase
    .from('resources')
    .select(
      'id,title,description,resource_type,file_name,file_size,mime_type,external_url,subject_id,tags,created_at,subjects(name,color)',
    );

  if (options.subjectId) query = query.eq('subject_id', options.subjectId);
  if (options.type) query = query.eq('resource_type', options.type);
  // ilike is fine for the library's own filter box; full-text search is the
  // global palette's job.
  if (options.q?.trim()) query = query.ilike('title', `%${options.q.trim()}%`);

  const { data, error } = await query.order('created_at', { ascending: false }).limit(300);

  if (error) {
    console.error('listResources failed:', error.message);
    return [];
  }
  return (data ?? []) as ResourceListItem[];
}
