create extension if not exists pgcrypto;

create type public.test_type as enum (
  'SAT',
  'ACT',
  'SSAT',
  'AP',
  'AMC',
  'Custom'
);

create type public.review_result as enum (
  'correct',
  'wrong_again',
  'still_slow',
  'needs_review',
  'skipped'
);

create type public.review_status as enum (
  'scheduled',
  'completed',
  'canceled'
);

create table public.student_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  first_review_delay_days integer not null default 10 check (first_review_delay_days >= 1),
  second_review_delay_days integer not null default 20 check (second_review_delay_days >= 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.questions (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.student_profiles(id) on delete cascade,
  test_type public.test_type not null,
  source text,
  test_name text,
  section_module text,
  question_number text,
  screenshot_path text not null,
  topic text not null,
  subtopic text,
  error_type text not null,
  correct_answer text not null default 'Not set',
  time_spent_seconds integer check (time_spent_seconds is null or time_spent_seconds >= 0),
  correct_strategy text,
  notes text,
  logged_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint screenshot_path_owner_format
    check (screenshot_path like ('users/' || student_id::text || '/questions/%')),
  constraint questions_correct_answer_not_blank
    check (char_length(btrim(correct_answer)) > 0)
);

create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.student_profiles(id) on delete cascade,
  question_id uuid not null references public.questions(id) on delete cascade,
  review_round integer not null check (review_round >= 1),
  due_date date not null,
  status public.review_status not null default 'scheduled',
  result public.review_result,
  completed_at timestamptz,
  keep_next_review boolean,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (question_id, review_round),
  constraint completed_reviews_have_result
    check (
      (status = 'completed' and result is not null and completed_at is not null)
      or
      (status <> 'completed' and result is null and completed_at is null)
    )
);

create index questions_student_logged_idx on public.questions(student_id, logged_at desc);
create index questions_student_topic_idx on public.questions(student_id, topic, subtopic);
create index questions_student_error_type_idx on public.questions(student_id, error_type);
create index reviews_student_due_idx on public.reviews(student_id, status, due_date);
create index reviews_question_round_idx on public.reviews(question_id, review_round);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger student_profiles_set_updated_at
before update on public.student_profiles
for each row execute function public.set_updated_at();

create trigger questions_set_updated_at
before update on public.questions
for each row execute function public.set_updated_at();

create trigger reviews_set_updated_at
before update on public.reviews
for each row execute function public.set_updated_at();

create or replace function public.handle_new_student_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.student_profiles (id, display_name)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data ->> 'display_name', ''), split_part(new.email, '@', 1), 'Student')
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_student_profile();

create or replace function public.schedule_initial_question_reviews()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  first_delay integer;
  second_delay integer;
begin
  select first_review_delay_days, second_review_delay_days
  into first_delay, second_delay
  from public.student_profiles
  where id = new.student_id;

  insert into public.reviews (student_id, question_id, review_round, due_date)
  values
    (new.student_id, new.id, 1, (new.logged_at::date + coalesce(first_delay, 10))),
    (new.student_id, new.id, 2, (new.logged_at::date + coalesce(second_delay, 20)));

  return new;
end;
$$;

create trigger questions_schedule_initial_reviews
after insert on public.questions
for each row execute function public.schedule_initial_question_reviews();

create or replace function public.complete_review(
  p_review_id uuid,
  p_result public.review_result,
  p_keep_next_review boolean default null
)
returns public.reviews
language plpgsql
security invoker
set search_path = public
as $$
declare
  current_review public.reviews;
  profile public.student_profiles;
  next_due_date date;
  updated_review public.reviews;
begin
  select *
  into current_review
  from public.reviews
  where id = p_review_id
    and student_id = auth.uid()
  for update;

  if current_review.id is null then
    raise exception 'Review not found';
  end if;

  select *
  into profile
  from public.student_profiles
  where id = current_review.student_id;

  update public.reviews
  set status = 'completed',
      result = p_result,
      completed_at = now(),
      keep_next_review = case
        when p_result = 'correct' then coalesce(p_keep_next_review, false)
        else true
      end
  where id = p_review_id
  returning * into updated_review;

  if p_result = 'correct' and coalesce(p_keep_next_review, false) = false then
    update public.reviews
    set status = 'canceled'
    where question_id = current_review.question_id
      and student_id = current_review.student_id
      and review_round > current_review.review_round
      and status = 'scheduled';
  elsif not exists (
    select 1
    from public.reviews
    where question_id = current_review.question_id
      and student_id = current_review.student_id
      and review_round > current_review.review_round
      and status = 'scheduled'
  ) then
    next_due_date = current_date + coalesce(profile.second_review_delay_days, 20);

    insert into public.reviews (student_id, question_id, review_round, due_date)
    values (current_review.student_id, current_review.question_id, current_review.review_round + 1, next_due_date)
    on conflict (question_id, review_round) do nothing;
  end if;

  return updated_review;
end;
$$;

alter table public.student_profiles enable row level security;
alter table public.questions enable row level security;
alter table public.reviews enable row level security;

create policy "student_profiles_select_own"
on public.student_profiles for select to authenticated
using ((select auth.uid()) = id);

create policy "student_profiles_insert_own"
on public.student_profiles for insert to authenticated
with check ((select auth.uid()) = id);

create policy "student_profiles_update_own"
on public.student_profiles for update to authenticated
using ((select auth.uid()) = id)
with check ((select auth.uid()) = id);

create policy "student_profiles_delete_own"
on public.student_profiles for delete to authenticated
using ((select auth.uid()) = id);

create policy "questions_select_own"
on public.questions for select to authenticated
using ((select auth.uid()) = student_id);

create policy "questions_insert_own"
on public.questions for insert to authenticated
with check ((select auth.uid()) = student_id);

create policy "questions_update_own"
on public.questions for update to authenticated
using ((select auth.uid()) = student_id)
with check ((select auth.uid()) = student_id);

create policy "questions_delete_own"
on public.questions for delete to authenticated
using ((select auth.uid()) = student_id);

create policy "reviews_select_own"
on public.reviews for select to authenticated
using ((select auth.uid()) = student_id);

create policy "reviews_insert_own"
on public.reviews for insert to authenticated
with check (
  (select auth.uid()) = student_id
  and exists (
    select 1
    from public.questions q
    where q.id = question_id
      and q.student_id = (select auth.uid())
  )
);

create policy "reviews_update_own"
on public.reviews for update to authenticated
using ((select auth.uid()) = student_id)
with check (
  (select auth.uid()) = student_id
  and exists (
    select 1
    from public.questions q
    where q.id = question_id
      and q.student_id = (select auth.uid())
  )
);

create policy "reviews_delete_own"
on public.reviews for delete to authenticated
using ((select auth.uid()) = student_id);

insert into storage.buckets (id, name, public)
values ('question-screenshots', 'question-screenshots', false)
on conflict (id) do update set public = false;

create policy "screenshots_select_own_path"
on storage.objects for select to authenticated
using (
  bucket_id = 'question-screenshots'
  and (storage.foldername(name))[1] = 'users'
  and (storage.foldername(name))[2] = (select auth.uid())::text
);

create policy "screenshots_insert_own_path"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'question-screenshots'
  and (storage.foldername(name))[1] = 'users'
  and (storage.foldername(name))[2] = (select auth.uid())::text
);

create policy "screenshots_update_own_path"
on storage.objects for update to authenticated
using (
  bucket_id = 'question-screenshots'
  and (storage.foldername(name))[1] = 'users'
  and (storage.foldername(name))[2] = (select auth.uid())::text
)
with check (
  bucket_id = 'question-screenshots'
  and (storage.foldername(name))[1] = 'users'
  and (storage.foldername(name))[2] = (select auth.uid())::text
);

create policy "screenshots_delete_own_path"
on storage.objects for delete to authenticated
using (
  bucket_id = 'question-screenshots'
  and (storage.foldername(name))[1] = 'users'
  and (storage.foldername(name))[2] = (select auth.uid())::text
);
