create table if not exists public.admin_users (
  id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.admin_users enable row level security;

create policy "admin_users_select_own"
on public.admin_users for select to authenticated
using ((select auth.uid()) = id);

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.admin_users
    where id = (select auth.uid())
  );
$$;

create or replace function public.admin_student_summaries()
returns table (
  student_id uuid,
  email text,
  display_name text,
  created_at timestamptz,
  total_questions integer,
  due_reviews integer,
  done_questions integer,
  last_logged_at timestamptz,
  category_counts jsonb
)
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if not public.is_admin() then
    raise exception 'Admin access required';
  end if;

  return query
  with question_totals as (
    select
      q.student_id,
      count(*)::integer as total_questions,
      max(q.logged_at) as last_logged_at
    from public.questions q
    group by q.student_id
  ),
  done_totals as (
    select
      q.student_id,
      count(*)::integer as done_questions
    from public.questions q
    where not exists (
      select 1
      from public.reviews r
      where r.question_id = q.id
        and r.status = 'scheduled'
    )
    group by q.student_id
  ),
  due_totals as (
    select
      r.student_id,
      count(*)::integer as due_reviews
    from public.reviews r
    where r.status = 'scheduled'
      and r.due_date <= current_date
    group by r.student_id
  ),
  category_totals as (
    select
      category_rows.student_id,
      jsonb_object_agg(category_rows.topic, category_rows.question_count order by category_rows.topic) as category_counts
    from (
      select
        q.student_id,
        q.topic,
        count(*)::integer as question_count
      from public.questions q
      group by q.student_id, q.topic
    ) category_rows
    group by category_rows.student_id
  )
  select
    p.id as student_id,
    u.email::text as email,
    p.display_name,
    p.created_at,
    coalesce(qt.total_questions, 0) as total_questions,
    coalesce(dt.due_reviews, 0) as due_reviews,
    coalesce(done.done_questions, 0) as done_questions,
    qt.last_logged_at,
    coalesce(ct.category_counts, '{}'::jsonb) as category_counts
  from public.student_profiles p
  join auth.users u on u.id = p.id
  left join question_totals qt on qt.student_id = p.id
  left join due_totals dt on dt.student_id = p.id
  left join done_totals done on done.student_id = p.id
  left join category_totals ct on ct.student_id = p.id
  order by p.created_at desc;
end;
$$;

create or replace function public.admin_delete_student(p_student_id uuid)
returns void
language plpgsql
security definer
set search_path = public, storage, auth
as $$
begin
  if not public.is_admin() then
    raise exception 'Admin access required';
  end if;

  if p_student_id = (select auth.uid()) then
    raise exception 'Admins cannot delete their own account from this screen';
  end if;

  delete from storage.objects
  where bucket_id = 'question-screenshots'
    and name like ('users/' || p_student_id::text || '/questions/%');

  delete from auth.users
  where id = p_student_id;
end;
$$;

grant execute on function public.is_admin() to authenticated;
grant execute on function public.admin_student_summaries() to authenticated;
grant execute on function public.admin_delete_student(uuid) to authenticated;
