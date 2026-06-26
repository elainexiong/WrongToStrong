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

  delete from public.student_profiles
  where id = p_student_id;

  begin
    delete from auth.users
    where id = p_student_id;
  exception
    when others then
      raise warning 'Student profile deleted, but auth user delete failed for %: %', p_student_id, sqlerrm;
  end;
end;
$$;
