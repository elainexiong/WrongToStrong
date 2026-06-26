# Setup Checklist

## Local App

1. Install dependencies:

   ```bash
   npm install
   ```

2. Copy environment variables:

   ```bash
   cp .env.local.example .env.local
   ```

3. Fill in:

   ```txt
   NEXT_PUBLIC_SUPABASE_URL
   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
   ```

4. Start the app:

   ```bash
   npm run dev
   ```

## Supabase

1. Log in to Supabase CLI.
2. Link the WrongToStrong project.
3. Push migrations.

Example:

```bash
npx supabase login
npx supabase link --project-ref YOUR_PROJECT_REF
npx supabase db push
```

## Storage

The migration creates a private bucket:

```txt
question-screenshots
```

Screenshot path format:

```txt
users/{student_auth_user_id}/questions/{question_id}.webp
```

Only the authenticated owner can read/write objects under their own user folder.
