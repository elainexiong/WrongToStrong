insert into public.admin_users (id)
select id
from auth.users
where email = 'elaineping@gmail.com'
on conflict (id) do nothing;
