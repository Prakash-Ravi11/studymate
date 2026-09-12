'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { requireUser } from '@/lib/data/guards';

export type OnboardingState = { error: string | null };

/** Palette offered for the first subject; matches the design system accents. */
export const SUBJECT_COLORS = [
  '#4f46e5', '#7c3aed', '#0891b2', '#059669',
  '#d97706', '#dc2626', '#db2777', '#475569',
] as const;

export async function completeOnboarding(
  _prev: OnboardingState,
  formData: FormData,
): Promise<OnboardingState> {
  const user = await requireUser();
  const supabase = await createClient();

  const course = String(formData.get('course') ?? '').trim();
  const institution = String(formData.get('institution') ?? '').trim();
  const semesterRaw = String(formData.get('semester') ?? '').trim();
  const subjectName = String(formData.get('subject_name') ?? '').trim();
  const subjectColor = String(formData.get('subject_color') ?? '#4f46e5');
  // Captured client-side from Intl so reminders fire in the student's day,
  // not in UTC (section 12).
  const timezone = String(formData.get('timezone') ?? '').trim() || 'UTC';

  const semester = semesterRaw ? Number(semesterRaw) : null;
  if (semester !== null && (!Number.isInteger(semester) || semester < 1 || semester > 20)) {
    return { error: 'Semester should be a number between 1 and 20.' };
  }

  const { error: profileError } = await supabase
    .from('profiles')
    .update({
      course: course || null,
      institution: institution || null,
      semester,
      timezone,
      onboarded_at: new Date().toISOString(),
    })
    .eq('id', user.id);

  if (profileError) {
    console.error('Onboarding profile update failed:', profileError.message);
    return { error: 'We could not save your details. Please try again.' };
  }

  // The first subject is optional -- onboarding must not become a wall.
  if (subjectName) {
    const { error: subjectError } = await supabase.from('subjects').insert({
      user_id: user.id,
      name: subjectName,
      color: /^#[0-9A-Fa-f]{6}$/.test(subjectColor) ? subjectColor : '#4f46e5',
    });

    if (subjectError) {
      // The profile is already saved; report the partial outcome honestly
      // rather than claiming everything worked.
      console.error('First subject creation failed:', subjectError.message);
      return {
        error: 'Your details were saved, but we could not create that subject. Add it from Subjects.',
      };
    }
  }

  revalidatePath('/', 'layout');
  redirect('/home');
}

/** Skip link target: mark onboarding done without collecting anything. */
export async function skipOnboarding() {
  const user = await requireUser();
  const supabase = await createClient();
  await supabase
    .from('profiles')
    .update({ onboarded_at: new Date().toISOString() })
    .eq('id', user.id);
  revalidatePath('/', 'layout');
  redirect('/home');
}
