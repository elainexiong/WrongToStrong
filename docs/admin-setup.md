# Admin Setup

The admin UI lives at `/admin`.

Admin access is controlled by `public.admin_users`. A user must already exist in Supabase Auth before they can become an admin.

To promote one account, run this in the Supabase SQL editor:

```sql
insert into public.admin_users (id)
select id
from auth.users
where email = 'your-admin-email@example.com'
on conflict (id) do nothing;
```

Admins can see only aggregate student information:

- student display name and email
- total questions
- due reviews
- done questions
- counts by category

Admins cannot see question screenshots, answers, notes, or per-question details from the admin UI.

The delete button calls `public.admin_delete_student`, which removes the student's screenshot objects and deletes the Supabase Auth user. The student profile, questions, and reviews cascade from that delete.
