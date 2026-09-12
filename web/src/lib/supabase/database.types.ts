/**
 * Generated from the StudyMate Postgres schema (supabase/migrations/0001-0010).
 *
 * Regenerate after any migration:
 *   npx supabase gen types typescript --project-id <ref> > src/lib/supabase/database.types.ts
 *
 * The helper aliases at the bottom are deliberately simpler than the ones the
 * generator emits: those carry machinery for addressing non-public schemas,
 * which this app never does.
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  __InternalSupabase: { PostgrestVersion: '14.5' };
  public: {
    Tables: {
      activity: {
        Row: {
          created_at: string;
          entity_id: string | null;
          entity_title: string;
          entity_type: string;
          id: string;
          kind: Database['public']['Enums']['activity_kind'];
          subject_id: string | null;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          entity_id?: string | null;
          entity_title: string;
          entity_type: string;
          id?: string;
          kind: Database['public']['Enums']['activity_kind'];
          subject_id?: string | null;
          user_id: string;
        };
        Update: {
          created_at?: string;
          entity_id?: string | null;
          entity_title?: string;
          entity_type?: string;
          id?: string;
          kind?: Database['public']['Enums']['activity_kind'];
          subject_id?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'activity_subject_id_fkey';
            columns: ['subject_id'];
            isOneToOne: false;
            referencedRelation: 'subjects';
            referencedColumns: ['id'];
          },
        ];
      };
      note_attachments: {
        Row: { created_at: string; note_id: string; resource_id: string; user_id: string };
        Insert: { created_at?: string; note_id: string; resource_id: string; user_id: string };
        Update: { created_at?: string; note_id?: string; resource_id?: string; user_id?: string };
        Relationships: [
          {
            foreignKeyName: 'note_attachments_note_id_fkey';
            columns: ['note_id'];
            isOneToOne: false;
            referencedRelation: 'notes';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'note_attachments_resource_id_fkey';
            columns: ['resource_id'];
            isOneToOne: false;
            referencedRelation: 'resources';
            referencedColumns: ['id'];
          },
        ];
      };
      notes: {
        Row: {
          archived_at: string | null;
          content: string;
          content_text: string | null;
          created_at: string;
          id: string;
          is_favorite: boolean;
          is_pinned: boolean;
          note_type: Database['public']['Enums']['note_type'];
          search_tsv: unknown;
          subject_id: string | null;
          tags: string[];
          title: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          archived_at?: string | null;
          content?: string;
          created_at?: string;
          id?: string;
          is_favorite?: boolean;
          is_pinned?: boolean;
          note_type?: Database['public']['Enums']['note_type'];
          subject_id?: string | null;
          tags?: string[];
          title?: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          archived_at?: string | null;
          content?: string;
          id?: string;
          is_favorite?: boolean;
          is_pinned?: boolean;
          note_type?: Database['public']['Enums']['note_type'];
          subject_id?: string | null;
          tags?: string[];
          title?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'notes_subject_id_fkey';
            columns: ['subject_id'];
            isOneToOne: false;
            referencedRelation: 'subjects';
            referencedColumns: ['id'];
          },
        ];
      };
      profiles: {
        Row: {
          avatar_url: string | null;
          course: string | null;
          created_at: string;
          daily_summary_at: string;
          full_name: string | null;
          id: string;
          institution: string | null;
          notify_daily_summary: boolean;
          notify_deadline_reminders: boolean;
          notify_task_reminders: boolean;
          onboarded_at: string | null;
          semester: number | null;
          timezone: string;
          updated_at: string;
          year: number | null;
        };
        Insert: {
          avatar_url?: string | null;
          course?: string | null;
          created_at?: string;
          daily_summary_at?: string;
          full_name?: string | null;
          id: string;
          institution?: string | null;
          notify_daily_summary?: boolean;
          notify_deadline_reminders?: boolean;
          notify_task_reminders?: boolean;
          onboarded_at?: string | null;
          semester?: number | null;
          timezone?: string;
          updated_at?: string;
          year?: number | null;
        };
        Update: {
          avatar_url?: string | null;
          course?: string | null;
          daily_summary_at?: string;
          full_name?: string | null;
          institution?: string | null;
          notify_daily_summary?: boolean;
          notify_deadline_reminders?: boolean;
          notify_task_reminders?: boolean;
          onboarded_at?: string | null;
          semester?: number | null;
          timezone?: string;
          updated_at?: string;
          year?: number | null;
        };
        Relationships: [];
      };
      reminders: {
        Row: {
          channel: Database['public']['Enums']['reminder_channel'];
          created_at: string;
          error: string | null;
          fire_at: string;
          id: string;
          label: string | null;
          offset_minutes: number | null;
          repeat_rule: string | null;
          sent_at: string | null;
          status: Database['public']['Enums']['reminder_status'];
          task_id: string | null;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          channel?: Database['public']['Enums']['reminder_channel'];
          created_at?: string;
          error?: string | null;
          fire_at: string;
          id?: string;
          label?: string | null;
          offset_minutes?: number | null;
          repeat_rule?: string | null;
          sent_at?: string | null;
          status?: Database['public']['Enums']['reminder_status'];
          task_id?: string | null;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          channel?: Database['public']['Enums']['reminder_channel'];
          error?: string | null;
          fire_at?: string;
          label?: string | null;
          offset_minutes?: number | null;
          repeat_rule?: string | null;
          sent_at?: string | null;
          status?: Database['public']['Enums']['reminder_status'];
          task_id?: string | null;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'reminders_task_id_fkey';
            columns: ['task_id'];
            isOneToOne: false;
            referencedRelation: 'tasks';
            referencedColumns: ['id'];
          },
        ];
      };
      resources: {
        Row: {
          created_at: string;
          description: string | null;
          external_url: string | null;
          file_name: string | null;
          file_path: string | null;
          file_size: number | null;
          id: string;
          mime_type: string | null;
          resource_type: Database['public']['Enums']['resource_type'];
          search_tsv: unknown;
          subject_id: string | null;
          tags: string[];
          thumbnail_path: string | null;
          title: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          description?: string | null;
          external_url?: string | null;
          file_name?: string | null;
          file_path?: string | null;
          file_size?: number | null;
          id?: string;
          mime_type?: string | null;
          resource_type?: Database['public']['Enums']['resource_type'];
          subject_id?: string | null;
          tags?: string[];
          thumbnail_path?: string | null;
          title: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          description?: string | null;
          external_url?: string | null;
          file_name?: string | null;
          file_path?: string | null;
          file_size?: number | null;
          mime_type?: string | null;
          resource_type?: Database['public']['Enums']['resource_type'];
          subject_id?: string | null;
          tags?: string[];
          thumbnail_path?: string | null;
          title?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'resources_subject_id_fkey';
            columns: ['subject_id'];
            isOneToOne: false;
            referencedRelation: 'subjects';
            referencedColumns: ['id'];
          },
        ];
      };
      subjects: {
        Row: {
          archived_at: string | null;
          code: string | null;
          color: string;
          created_at: string;
          description: string | null;
          icon: string | null;
          id: string;
          instructor: string | null;
          name: string;
          search_tsv: unknown;
          semester: number | null;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          archived_at?: string | null;
          code?: string | null;
          color?: string;
          created_at?: string;
          description?: string | null;
          icon?: string | null;
          id?: string;
          instructor?: string | null;
          name: string;
          semester?: number | null;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          archived_at?: string | null;
          code?: string | null;
          color?: string;
          description?: string | null;
          icon?: string | null;
          instructor?: string | null;
          name?: string;
          semester?: number | null;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      task_attachments: {
        Row: { created_at: string; resource_id: string; task_id: string; user_id: string };
        Insert: { created_at?: string; resource_id: string; task_id: string; user_id: string };
        Update: { created_at?: string; resource_id?: string; task_id?: string; user_id?: string };
        Relationships: [
          {
            foreignKeyName: 'task_attachments_resource_id_fkey';
            columns: ['resource_id'];
            isOneToOne: false;
            referencedRelation: 'resources';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'task_attachments_task_id_fkey';
            columns: ['task_id'];
            isOneToOne: false;
            referencedRelation: 'tasks';
            referencedColumns: ['id'];
          },
        ];
      };
      tasks: {
        Row: {
          cancelled_at: string | null;
          completed_at: string | null;
          created_at: string;
          description: string | null;
          due_at: string | null;
          due_has_time: boolean;
          id: string;
          note_id: string | null;
          priority: Database['public']['Enums']['task_priority'];
          repeat_rule: string | null;
          repeat_until: string | null;
          search_tsv: unknown;
          status: Database['public']['Enums']['task_status'];
          subject_id: string | null;
          tags: string[];
          title: string;
          updated_at: string;
          user_id: string;
          voice_note_id: string | null;
        };
        Insert: {
          cancelled_at?: string | null;
          completed_at?: string | null;
          created_at?: string;
          description?: string | null;
          due_at?: string | null;
          due_has_time?: boolean;
          id?: string;
          note_id?: string | null;
          priority?: Database['public']['Enums']['task_priority'];
          repeat_rule?: string | null;
          repeat_until?: string | null;
          status?: Database['public']['Enums']['task_status'];
          subject_id?: string | null;
          tags?: string[];
          title: string;
          updated_at?: string;
          user_id: string;
          voice_note_id?: string | null;
        };
        Update: {
          cancelled_at?: string | null;
          completed_at?: string | null;
          description?: string | null;
          due_at?: string | null;
          due_has_time?: boolean;
          note_id?: string | null;
          priority?: Database['public']['Enums']['task_priority'];
          repeat_rule?: string | null;
          repeat_until?: string | null;
          status?: Database['public']['Enums']['task_status'];
          subject_id?: string | null;
          tags?: string[];
          title?: string;
          updated_at?: string;
          user_id?: string;
          voice_note_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'tasks_note_id_fkey';
            columns: ['note_id'];
            isOneToOne: false;
            referencedRelation: 'notes';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'tasks_subject_id_fkey';
            columns: ['subject_id'];
            isOneToOne: false;
            referencedRelation: 'subjects';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'tasks_voice_note_id_fkey';
            columns: ['voice_note_id'];
            isOneToOne: false;
            referencedRelation: 'voice_notes';
            referencedColumns: ['id'];
          },
        ];
      };
      voice_notes: {
        Row: {
          created_at: string;
          duration_ms: number | null;
          file_name: string;
          file_path: string;
          file_size: number | null;
          id: string;
          mime_type: string;
          search_tsv: unknown;
          subject_id: string | null;
          tags: string[];
          title: string;
          transcribed_at: string | null;
          transcript: string | null;
          transcription_error: string | null;
          transcription_status: Database['public']['Enums']['transcription_status'];
          updated_at: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          duration_ms?: number | null;
          file_name: string;
          file_path: string;
          file_size?: number | null;
          id?: string;
          mime_type: string;
          subject_id?: string | null;
          tags?: string[];
          title?: string;
          transcribed_at?: string | null;
          transcript?: string | null;
          transcription_error?: string | null;
          transcription_status?: Database['public']['Enums']['transcription_status'];
          updated_at?: string;
          user_id: string;
        };
        Update: {
          duration_ms?: number | null;
          file_name?: string;
          file_path?: string;
          file_size?: number | null;
          mime_type?: string;
          subject_id?: string | null;
          tags?: string[];
          title?: string;
          transcribed_at?: string | null;
          transcript?: string | null;
          transcription_error?: string | null;
          transcription_status?: Database['public']['Enums']['transcription_status'];
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'voice_notes_subject_id_fkey';
            columns: ['subject_id'];
            isOneToOne: false;
            referencedRelation: 'subjects';
            referencedColumns: ['id'];
          },
        ];
      };
    };
    Views: {
      /** Read-only: subjects joined to their counts (migration 0011). */
      subject_overview: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          code: string | null;
          description: string | null;
          color: string;
          icon: string | null;
          instructor: string | null;
          semester: number | null;
          archived_at: string | null;
          created_at: string;
          updated_at: string;
          open_tasks: number;
          overdue_tasks: number;
          done_tasks: number;
          total_tasks: number;
          note_count: number;
          resource_count: number;
          voice_count: number;
          last_activity_at: string;
        };
        Relationships: [];
      };
    };
    Functions: {
      search_all: {
        Args: { q: string; p_types?: string[]; p_subject_id?: string; p_limit?: number };
        Returns: {
          entity_type: string;
          id: string;
          title: string;
          snippet: string;
          subject_id: string;
          rank: number;
          occurred_at: string;
        }[];
      };
      tags_to_text: { Args: { tags: string[] }; Returns: string };
    };
    Enums: {
      activity_kind: 'created' | 'updated' | 'completed' | 'deleted' | 'uploaded' | 'recorded';
      note_type: 'quick' | 'class' | 'study' | 'assignment';
      reminder_channel: 'in_app' | 'push' | 'email';
      reminder_status: 'scheduled' | 'sent' | 'dismissed' | 'failed' | 'cancelled';
      resource_type:
        | 'pdf' | 'document' | 'presentation' | 'spreadsheet'
        | 'image' | 'link' | 'video' | 'audio' | 'other';
      task_priority: 'none' | 'low' | 'medium' | 'high' | 'urgent';
      task_status: 'inbox' | 'planned' | 'in_progress' | 'completed' | 'cancelled';
      transcription_status:
        | 'none' | 'pending' | 'processing' | 'completed' | 'failed' | 'unsupported';
    };
    CompositeTypes: Record<never, never>;
  };
};

type PublicSchema = Database['public'];

export type Tables<T extends keyof PublicSchema['Tables']> = PublicSchema['Tables'][T]['Row'];
export type Views<T extends keyof PublicSchema['Views']> = PublicSchema['Views'][T]['Row'];
export type TablesInsert<T extends keyof PublicSchema['Tables']> = PublicSchema['Tables'][T]['Insert'];
export type TablesUpdate<T extends keyof PublicSchema['Tables']> = PublicSchema['Tables'][T]['Update'];
export type Enums<T extends keyof PublicSchema['Enums']> = PublicSchema['Enums'][T];

/** Row shapes used across the app. */
export type Profile = Tables<'profiles'>;
export type Subject = Tables<'subjects'>;
export type Resource = Tables<'resources'>;
export type Note = Tables<'notes'>;
export type VoiceNote = Tables<'voice_notes'>;
export type Task = Tables<'tasks'>;
export type Reminder = Tables<'reminders'>;
export type Activity = Tables<'activity'>;
export type SubjectOverview = Views<'subject_overview'>;

export type TaskStatus = Enums<'task_status'>;
export type TaskPriority = Enums<'task_priority'>;
export type NoteType = Enums<'note_type'>;
export type ResourceType = Enums<'resource_type'>;
export type TranscriptionStatus = Enums<'transcription_status'>;
export type ReminderChannel = Enums<'reminder_channel'>;

export type SearchHit = PublicSchema['Functions']['search_all']['Returns'][number];
