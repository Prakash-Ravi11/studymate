import type { Metadata } from 'next';
import { PageContainer } from '@/components/shell/page-header';
import { SubjectsClient } from '@/components/subjects/subjects-client';
import { requireOnboardedUser } from '@/lib/data/guards';
import { listSubjects } from '@/lib/data/subjects';

export const metadata: Metadata = { title: 'Subjects' };

export default async function SubjectsPage({
  searchParams,
}: {
  searchParams: Promise<{ archived?: string }>;
}) {
  await requireOnboardedUser();
  const { archived } = await searchParams;
  const showingArchived = archived === '1';

  const all = await listSubjects({ includeArchived: true });
  const subjects = showingArchived
    ? all.filter((s) => s.archived_at)
    : all.filter((s) => !s.archived_at);

  return (
    <PageContainer width="wide">
      <SubjectsClient subjects={subjects} showingArchived={showingArchived} />
    </PageContainer>
  );
}
