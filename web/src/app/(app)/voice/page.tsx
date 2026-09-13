import type { Metadata } from 'next';
import { PageContainer } from '@/components/shell/page-header';
import { VoiceRecorder } from '@/components/voice/recorder';
import { VoiceList } from '@/components/voice/voice-list';
import { requireOnboardedUser } from '@/lib/data/guards';
import { listSubjectOptions } from '@/lib/data/subjects';
import { createClient } from '@/lib/supabase/server';
import { isTranscriptionEnabled } from '@/lib/transcription';

export const metadata: Metadata = { title: 'Voice notes' };

export default async function VoicePage() {
  await requireOnboardedUser();
  const supabase = await createClient();

  const [{ data: items }, subjects] = await Promise.all([
    supabase
      .from('voice_notes')
      .select(
        'id,title,duration_ms,created_at,transcript,transcription_status,transcription_error,subject_id,subjects(name,color)',
      )
      .order('created_at', { ascending: false })
      .limit(100),
    listSubjectOptions(),
  ]);

  return (
    <PageContainer width="narrow">
      <div className="pb-5">
        <h1 className="text-xl font-semibold tracking-tight text-content">Voice notes</h1>
        <p className="mt-1 text-sm text-content-secondary">
          Record what was said, find it later by what it was about.
        </p>
      </div>

      <VoiceRecorder subjects={subjects} />

      <VoiceList
        items={(items ?? []) as Parameters<typeof VoiceList>[0]['items']}
        canTranscribe={isTranscriptionEnabled()}
      />
    </PageContainer>
  );
}
