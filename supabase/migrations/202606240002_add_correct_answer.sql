alter table public.questions
add column if not exists correct_answer text;

update public.questions
set correct_answer = 'Not set'
where correct_answer is null or btrim(correct_answer) = '';

alter table public.questions
alter column correct_answer set default 'Not set',
alter column correct_answer set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'questions_correct_answer_not_blank'
      and conrelid = 'public.questions'::regclass
  ) then
    alter table public.questions
    add constraint questions_correct_answer_not_blank
    check (char_length(btrim(correct_answer)) > 0);
  end if;
end $$;
