import type { Metadata } from 'next';
import { ClassMode } from '@/components/shell/class-mode';
import { requireOnboardedUser } from '@/lib/data/guards';
import { listSubjectOptions } from '@/lib/data/subjects';

export const metadata: Metadata = { title: 'Class mode' };

export default async function ClassModePage() {
  const { profile } = await requireOnboardedUser();
  const subjects = await listSubjectOptions();

  return <ClassMode subjects={subjects} timezone={profile?.timezone ?? 'UTC'} />;
}
