create table if not exists public.lesson_feedback (
  id uuid primary key,
  user_id uuid default auth.uid() references auth.users(id) on delete set null,
  lesson_id text not null check (lesson_id in (
    'm1-l1', 'm1-l2', 'm1-l3', 'm1-l4', 'm1-l5',
    'm2-l1', 'm2-l2', 'm2-l3', 'm2-l4', 'm2-l5'
  )),
  content_version text not null check (char_length(content_version) between 1 and 120),
  rating smallint not null check (rating between 1 and 5),
  comment text check (comment is null or char_length(comment) <= 1000),
  created_at timestamptz not null default now()
);

alter table public.lesson_feedback enable row level security;

revoke all on table public.lesson_feedback from anon, authenticated;
grant insert on table public.lesson_feedback to anon, authenticated;

drop policy if exists "Anyone may submit bounded lesson feedback" on public.lesson_feedback;
create policy "Anyone may submit bounded lesson feedback"
on public.lesson_feedback
for insert
to anon, authenticated
with check (user_id is null or user_id = auth.uid());

comment on table public.lesson_feedback is
  'Optional lesson quality rating and comment. Never stores rehearsal audio or transcripts.';
