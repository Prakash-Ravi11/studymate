'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Download, LogOut, Check } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Field, Input } from '@/components/ui/field';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/toast';
import { ThemeToggle } from '@/components/shell/theme-toggle';
import { updateProfile, updateNotificationPrefs, exportMyData } from '@/lib/actions/profile';
import { signOut } from '@/lib/actions/auth';
import { cn } from '@/lib/utils';
import type { Profile } from '@/lib/supabase/database.types';

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="p-5">
      <h2 className="text-sm font-semibold text-content">{title}</h2>
      {description && <p className="mt-0.5 text-xs text-content-secondary">{description}</p>}
      <div className="mt-4">{children}</div>
    </Card>
  );
}

function Toggle({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4 py-2.5">
      <div className="min-w-0">
        <p className="text-xs font-medium text-content">{label}</p>
        {description && <p className="mt-0.5 text-2xs text-content-tertiary">{description}</p>}
      </div>
      <button
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        className={cn(
          'relative h-5 w-9 shrink-0 rounded-full transition-colors',
          checked ? 'bg-primary' : 'bg-line-strong',
        )}
      >
        <span
          aria-hidden="true"
          className={cn(
            'absolute top-0.5 size-4 rounded-full bg-white transition-transform',
            checked ? 'translate-x-4' : 'translate-x-0.5',
          )}
        />
      </button>
    </div>
  );
}

export function SettingsClient({ profile, email }: { profile: Profile; email: string }) {
  const router = useRouter();
  const toast = useToast();
  const [savingProfile, setSavingProfile] = React.useState(false);
  const [exporting, setExporting] = React.useState(false);
  const [prefs, setPrefs] = React.useState({
    task: profile.notify_task_reminders,
    deadline: profile.notify_deadline_reminders,
    summary: profile.notify_daily_summary,
  });

  const browserZone = React.useMemo(() => {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone;
    } catch {
      return null;
    }
  }, []);

  async function saveProfile(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const sem = String(form.get('semester') ?? '').trim();
    const yr = String(form.get('year') ?? '').trim();

    setSavingProfile(true);
    const result = await updateProfile({
      fullName: String(form.get('full_name') ?? ''),
      institution: String(form.get('institution') ?? ''),
      course: String(form.get('course') ?? ''),
      semester: sem ? Number(sem) : null,
      year: yr ? Number(yr) : null,
    });
    setSavingProfile(false);

    if (!result.ok) return toast(result.error, 'error');
    toast('Profile saved', 'success');
    router.refresh();
  }

  async function savePref(key: keyof typeof prefs, value: boolean) {
    const previous = prefs;
    setPrefs((p) => ({ ...p, [key]: value }));

    const result = await updateNotificationPrefs({
      ...(key === 'task' && { taskReminders: value }),
      ...(key === 'deadline' && { deadlineReminders: value }),
      ...(key === 'summary' && { dailySummary: value }),
    });

    if (!result.ok) {
      setPrefs(previous);
      toast(result.error, 'error');
    }
  }

  async function adoptBrowserZone() {
    if (!browserZone) return;
    const result = await updateProfile({ timezone: browserZone });
    if (!result.ok) return toast(result.error, 'error');
    toast(`Timezone set to ${browserZone}`, 'success');
    router.refresh();
  }

  async function runExport() {
    setExporting(true);
    const result = await exportMyData();
    setExporting(false);
    if (!result.ok) return toast(result.error, 'error');

    const blob = new Blob([result.data.json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `studymate-export-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast('Export downloaded', 'success');
  }

  return (
    <div className="space-y-4">
      <Section title="Profile" description="Used to personalise your dashboard.">
        <form onSubmit={saveProfile} className="space-y-4">
          <Field label="Full name">
            {(a) => <Input {...a} name="full_name" defaultValue={profile.full_name ?? ''} />}
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Institution">
              {(a) => <Input {...a} name="institution" defaultValue={profile.institution ?? ''} />}
            </Field>
            <Field label="Course">
              {(a) => <Input {...a} name="course" defaultValue={profile.course ?? ''} />}
            </Field>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Year">
              {(a) => (
                <Input {...a} name="year" type="number" min={1} max={10} defaultValue={profile.year ?? ''} />
              )}
            </Field>
            <Field label="Semester">
              {(a) => (
                <Input
                  {...a}
                  name="semester"
                  type="number"
                  min={1}
                  max={20}
                  defaultValue={profile.semester ?? ''}
                />
              )}
            </Field>
          </div>
          <div className="flex justify-end">
            <Button type="submit" loading={savingProfile}>
              Save profile
            </Button>
          </div>
        </form>
      </Section>

      <Section title="Appearance">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-content">Theme</p>
            <p className="mt-0.5 text-2xs text-content-tertiary">
              System follows your device setting.
            </p>
          </div>
          <ThemeToggle />
        </div>
      </Section>

      <Section
        title="Time zone"
        description="Deadlines and reminders are shown and scheduled in this zone."
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-content">
            Currently <span className="font-medium">{profile.timezone}</span>
          </p>
          {browserZone && browserZone !== profile.timezone && (
            <Button size="sm" variant="outline" onClick={adoptBrowserZone}>
              Use {browserZone}
            </Button>
          )}
          {browserZone === profile.timezone && (
            <span className="flex items-center gap-1 text-2xs text-success">
              <Check className="size-3" aria-hidden="true" /> Matches this device
            </span>
          )}
        </div>
      </Section>

      <Section
        title="Notifications"
        description="Which reminders StudyMate should raise. Delivery channels are configured per deployment."
      >
        <div className="divide-y divide-line">
          <Toggle
            label="Task reminders"
            description="Reminders you attach to individual tasks."
            checked={prefs.task}
            onChange={(v) => void savePref('task', v)}
          />
          <Toggle
            label="Deadline reminders"
            description="Nudges as a due date approaches."
            checked={prefs.deadline}
            onChange={(v) => void savePref('deadline', v)}
          />
          <Toggle
            label="Daily summary"
            description="One digest of what is due that day."
            checked={prefs.summary}
            onChange={(v) => void savePref('summary', v)}
          />
        </div>
      </Section>

      <Section title="Account">
        <div className="space-y-3">
          <div>
            <p className="text-xs font-medium text-content">Email</p>
            <p className="mt-0.5 text-xs text-content-secondary">{email}</p>
          </div>
          <div className="flex flex-wrap gap-2 border-t border-line pt-3">
            <Button variant="outline" onClick={runExport} loading={exporting}>
              <Download className="size-4" aria-hidden="true" />
              Export my data
            </Button>
            <form action={signOut}>
              <Button type="submit" variant="ghost">
                <LogOut className="size-4" aria-hidden="true" />
                Sign out
              </Button>
            </form>
          </div>
          <p className="text-2xs text-content-tertiary">
            The export contains your profile, subjects, tasks, notes and metadata as JSON. Files and
            recordings are referenced by path — download them from their own pages.
          </p>
        </div>
      </Section>
    </div>
  );
}
