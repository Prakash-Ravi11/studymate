-- StudyMate demo seed.
--
--   psql "$DATABASE_URL" -f supabase/seed/demo.sql
--
-- Populates demo@studymate.app with a realistic term's worth of academic data so
-- the dashboard, subjects, tasks, calendar and search can all be explored
-- immediately. Safe to re-run: it clears this user's rows first.
--
-- Deliberately NOT seeded: resources and voice notes. Those rows carry a
-- file_path into Supabase Storage, and inserting metadata without the
-- corresponding object would produce file cards that fail on download and
-- recordings that fail on play. An empty state that invites a real upload is
-- honest; a broken card is not.
--
-- All due dates are relative to now(), so the dashboard always has genuinely
-- overdue, due-today and upcoming work no matter when this runs.

do $$
declare
  uid uuid;
  tz  text := 'Asia/Kolkata';
  s_maths uuid; s_dsa uuid; s_dbms uuid; s_os uuid; s_english uuid;
  n_laplace uuid; n_trees uuid;
begin
  select id into uid from auth.users where email = 'demo@studymate.app';
  if uid is null then
    raise exception 'demo@studymate.app does not exist -- create the account first';
  end if;

  -- Idempotent: wipe this user's content before reseeding.
  delete from public.activity where user_id = uid;
  delete from public.reminders where user_id = uid;
  delete from public.tasks    where user_id = uid;
  delete from public.notes    where user_id = uid;
  delete from public.subjects where user_id = uid;

  -- ------------------------------------------------------------- subjects
  insert into public.subjects (user_id, name, code, color, instructor, semester, description)
  values
    (uid, 'Engineering Mathematics III', 'MA8351', '#4f46e5', 'Dr. R. Meenakshi', 5,
     'Laplace transforms, Fourier series, complex variables.'),
    (uid, 'Data Structures & Algorithms', 'CS8391', '#0891b2', 'Prof. S. Anand', 5,
     'Trees, graphs, sorting, complexity analysis.'),
    (uid, 'Database Management Systems', 'CS8492', '#059669', 'Dr. K. Priya', 5,
     'Relational model, normalisation, transactions, indexing.'),
    (uid, 'Operating Systems', 'CS8493', '#d97706', 'Prof. M. Rajan', 5,
     'Processes, scheduling, memory management, file systems.'),
    (uid, 'Technical English', 'HS8381', '#7c3aed', 'Ms. L. Fernandes', 5,
     'Presentation skills and technical writing.');

  select id into s_maths   from public.subjects where user_id = uid and code = 'MA8351';
  select id into s_dsa     from public.subjects where user_id = uid and code = 'CS8391';
  select id into s_dbms    from public.subjects where user_id = uid and code = 'CS8492';
  select id into s_os      from public.subjects where user_id = uid and code = 'CS8493';
  select id into s_english from public.subjects where user_id = uid and code = 'HS8381';

  -- ---------------------------------------------------------------- notes
  insert into public.notes (user_id, subject_id, title, content, note_type, tags, is_pinned)
  values
    (uid, s_maths, 'Unit 3 — Laplace transforms',
     '<h2>Laplace transforms</h2><p>Definition: <code>L{f(t)} = ∫₀^∞ e^(-st) f(t) dt</code></p>'
     '<p>Key results covered in class:</p><ul><li>Linearity holds, so transforms distribute over sums.</li>'
     '<li>First shifting theorem: <code>L{e^(at) f(t)} = F(s-a)</code>.</li>'
     '<li>Transform of derivatives is the one that matters for solving ODEs.</li></ul>'
     '<blockquote>Exam tip from Dr. Meenakshi: at least one full question comes from '
     'the inverse transform by partial fractions. Practise those.</blockquote>',
     'class', array['unit3','laplace','exam'], true),

    (uid, s_dsa, 'Balanced trees — AVL vs Red-Black',
     '<h2>When each one wins</h2><p>Both give O(log n), the difference is the constant.</p>'
     '<ul><li><strong>AVL</strong> is more strictly balanced, so lookups are faster.</li>'
     '<li><strong>Red-Black</strong> rebalances less on insert, so writes are cheaper.</li></ul>'
     '<p>Rule of thumb: read-heavy workload → AVL, write-heavy → Red-Black.</p>',
     'study', array['trees','revision'], true),

    (uid, s_dbms, 'Normalisation worked example',
     '<p>Walked a denormalised student-enrolment table from 1NF through to 3NF.</p>'
     '<ol><li>1NF: removed the repeating group of subject columns.</li>'
     '<li>2NF: split out subject details, which depended on only part of the key.</li>'
     '<li>3NF: pulled instructor details out of the subject table.</li></ol>'
     '<p>Need to redo this for the BCNF case before the lab exam.</p>',
     'study', array['normalisation','lab'], false),

    (uid, s_os, 'Scheduling algorithms — quick reference',
     '<p>FCFS, SJF, Round Robin, Priority. The exam asks for Gantt charts plus '
     'average waiting time, so practise the arithmetic, not just the theory.</p>'
     '<p>Round Robin: waiting time depends heavily on the quantum. Too small and '
     'context-switch overhead dominates.</p>',
     'class', array['scheduling'], false),

    (uid, null, 'Things to ask in office hours',
     '<ul><li>Whether the DBMS lab exam allows a reference sheet.</li>'
     '<li>Clarify the marking split on the maths assignment.</li></ul>',
     'quick', array['todo'], false);

  select id into n_laplace from public.notes where user_id = uid and title like 'Unit 3%';
  select id into n_trees   from public.notes where user_id = uid and title like 'Balanced trees%';

  -- ---------------------------------------------------------------- tasks
  -- Overdue: the dashboard must surface these first.
  insert into public.tasks (user_id, subject_id, title, description, status, priority,
                            due_at, due_has_time, tags, note_id)
  values
    (uid, s_maths, 'Finish Unit 3 questions 5-20',
     'Laplace transform problems from the Unit 3 problem set.',
     'in_progress', 'high',
     (date_trunc('day', now() at time zone tz) - interval '1 day' + interval '18 hours') at time zone tz,
     true, array['assignment','unit3'], n_laplace),

    (uid, s_dbms, 'Submit DBMS lab record',
     'Experiments 1 to 6, signed.',
     'planned', 'urgent',
     (date_trunc('day', now() at time zone tz) - interval '2 days' + interval '17 hours') at time zone tz,
     true, array['lab'], null),

  -- Due today
    (uid, s_dsa, 'Implement AVL rotations',
     'Single and double rotations, with the test cases from the tutorial.',
     'planned', 'high',
     (date_trunc('day', now() at time zone tz) + interval '20 hours') at time zone tz,
     true, array['coding'], n_trees),

    (uid, s_os, 'Read chapter 5 — process scheduling',
     null, 'planned', 'medium',
     (date_trunc('day', now() at time zone tz) + interval '22 hours') at time zone tz,
     true, array['reading'], null),

  -- This week
    (uid, s_english, 'Prepare 5-minute technical presentation',
     'Topic: why index selection matters. Slides plus a practice run.',
     'planned', 'medium',
     (date_trunc('day', now() at time zone tz) + interval '2 days' + interval '11 hours') at time zone tz,
     true, array['presentation'], null),

    (uid, s_maths, 'Revise Fourier series before the unit test',
     null, 'planned', 'high',
     (date_trunc('day', now() at time zone tz) + interval '4 days') at time zone tz,
     false, array['exam','revision'], null),

    (uid, s_dbms, 'Normalisation problem set',
     'Up to BCNF, including the worked example from class.',
     'planned', 'medium',
     (date_trunc('day', now() at time zone tz) + interval '5 days' + interval '18 hours') at time zone tz,
     true, array['assignment'], null),

  -- Unscheduled: captured in class, not yet planned.
    (uid, s_dsa, 'Ask Prof. Anand about graph traversal assignment scope',
     null, 'inbox', 'none', null, false, array[]::text[], null),

    (uid, null, 'Find a past paper for Operating Systems',
     null, 'inbox', 'low', null, false, array[]::text[], null),

  -- Completed this week: feeds the "Done" figure on the dashboard.
    (uid, s_dsa, 'Tutorial sheet 4 — complexity analysis',
     null, 'completed', 'medium',
     (date_trunc('day', now() at time zone tz) - interval '3 days' + interval '16 hours') at time zone tz,
     true, array['tutorial'], null),

    (uid, s_os, 'Lab exercise 3 — shell scripting',
     null, 'completed', 'low',
     (date_trunc('day', now() at time zone tz) - interval '4 days' + interval '15 hours') at time zone tz,
     true, array['lab'], null),

    (uid, s_maths, 'Unit 2 assignment',
     null, 'completed', 'high',
     (date_trunc('day', now() at time zone tz) - interval '6 days' + interval '17 hours') at time zone tz,
     true, array['assignment'], null);

  -- ------------------------------------------------------------ reminders
  -- Relative reminders on the two most urgent pieces of work. offset_minutes is
  -- negative because it means "before the deadline"; the database trigger
  -- re-anchors fire_at automatically if the due date is later moved.
  insert into public.reminders (user_id, task_id, fire_at, offset_minutes, channel, status)
  select uid, t.id, t.due_at - interval '60 minutes', -60, 'in_app', 'scheduled'
  from public.tasks t
  where t.user_id = uid
    and t.status in ('planned', 'in_progress')
    and t.due_at is not null
    and t.title in ('Implement AVL rotations', 'Read chapter 5 — process scheduling');

  -- ------------------------------------------------------------- activity
  insert into public.activity (user_id, kind, entity_type, entity_id, subject_id, entity_title, created_at)
  values
    (uid, 'created', 'subject', s_dsa,   s_dsa,   'Data Structures & Algorithms', now() - interval '9 days'),
    (uid, 'created', 'note',    n_laplace, s_maths, 'Unit 3 — Laplace transforms',  now() - interval '5 days'),
    (uid, 'completed','task',   null,    s_maths, 'Unit 2 assignment',            now() - interval '6 days'),
    (uid, 'completed','task',   null,    s_os,    'Lab exercise 3 — shell scripting', now() - interval '4 days'),
    (uid, 'created', 'note',    n_trees, s_dsa,   'Balanced trees — AVL vs Red-Black', now() - interval '2 days'),
    (uid, 'completed','task',   null,    s_dsa,   'Tutorial sheet 4 — complexity analysis', now() - interval '3 days');
end $$;
