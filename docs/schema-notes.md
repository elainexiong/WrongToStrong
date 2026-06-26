# Schema Notes

The MVP uses the student-login model:

```txt
auth.users
  -> student_profiles
      -> questions
          -> reviews
```

`student_profiles.id` is the student's `auth.users.id`, so RLS can be written directly against `auth.uid()`.

## Tables

- `student_profiles`: per-student display name and review-window settings.
- `questions`: wrong-question log records and private screenshot paths.
- `reviews`: scheduled and completed review rounds.

## RLS

All application tables have explicit RLS enabled.

Every table policy checks:

```sql
(select auth.uid()) = student_id
```

or, for profiles:

```sql
(select auth.uid()) = id
```

## Storage

Bucket:

```txt
question-screenshots
```

Bucket is private.

Storage policies require:

```sql
bucket_id = 'question-screenshots'
and (storage.foldername(name))[1] = 'users'
and (storage.foldername(name))[2] = (select auth.uid())::text
```

This ensures students can only access screenshots under their own auth user id.
