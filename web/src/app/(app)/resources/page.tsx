import type { Metadata } from 'next';
import Link from 'next/link';
import { PageContainer } from '@/components/shell/page-header';
import { Uploader } from '@/components/resources/uploader';
import { ResourcesGrid } from '@/components/resources/resources-client';
import { requireOnboardedUser } from '@/lib/data/guards';
import { listResources } from '@/lib/data/resources';
import { listSubjectOptions } from '@/lib/data/subjects';
import { cn } from '@/lib/utils';
import type { ResourceType } from '@/lib/supabase/database.types';

export const metadata: Metadata = { title: 'Resources' };

const FILTERS: { value: ResourceType | 'all'; label: string }[] = [
  { value: 'all', label: 'Everything' },
  { value: 'pdf', label: 'PDFs' },
  { value: 'presentation', label: 'Slides' },
  { value: 'document', label: 'Documents' },
  { value: 'image', label: 'Images' },
  { value: 'spreadsheet', label: 'Sheets' },
  { value: 'link', label: 'Links' },
];

export default async function ResourcesPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; subject?: string }>;
}) {
  await requireOnboardedUser();
  const params = await searchParams;
  const type = FILTERS.find((f) => f.value === params.type)?.value;

  const [resources, subjects] = await Promise.all([
    listResources({
      subjectId: params.subject,
      type: type && type !== 'all' ? (type as ResourceType) : undefined,
    }),
    listSubjectOptions(),
  ]);

  return (
    <PageContainer width="wide">
      <div className="pb-5">
        <h1 className="text-xl font-semibold tracking-tight text-content">Resources</h1>
        <p className="mt-1 text-sm text-content-secondary">
          Every slide deck, paper and PDF, filed by subject.
        </p>
      </div>

      <Uploader subjectId={params.subject} subjects={subjects} />

      <nav aria-label="Filter by type" className="mt-5 flex flex-wrap gap-1.5">
        {FILTERS.map((f) => {
          const active = (params.type ?? 'all') === f.value;
          return (
            <Link
              key={f.value}
              href={
                f.value === 'all'
                  ? `/resources${params.subject ? `?subject=${params.subject}` : ''}`
                  : `/resources?type=${f.value}${params.subject ? `&subject=${params.subject}` : ''}`
              }
              aria-current={active ? 'page' : undefined}
              className={cn(
                'rounded-full border px-2.5 py-1 text-2xs font-medium transition-colors',
                active
                  ? 'border-transparent bg-primary text-primary-contrast'
                  : 'border-line text-content-secondary hover:border-line-strong hover:text-content',
              )}
            >
              {f.label}
            </Link>
          );
        })}
      </nav>

      <ResourcesGrid resources={resources} subjects={subjects} />
    </PageContainer>
  );
}
