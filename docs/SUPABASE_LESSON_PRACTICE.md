# Supabase: lesson_practice table

Create this table so practice questions can be stored and served instantly.  
The `/api/generate-practice` route uses the **service role** client (`getSupabaseServer()`), which bypasses RLS, so the table must exist and be writable.

---

## 1. Create the table

Run in the **Supabase SQL Editor** (Dashboard → SQL Editor):

```sql
create table if not exists lesson_practice (
  lesson_id text primary key,
  questions_json jsonb not null,
  created_at timestamp with time zone default now()
);
```

- `lesson_id`: matches `Lesson.id` (e.g. `"1"`, `"2"`).
- `questions_json`: JSON object `{ "questions": [ { "question", "options", "correctIndex" }, ... ] }`.
- `created_at`: optional; set automatically.

---

## 2. Row Level Security (optional)

If you enable RLS on this table, the **service role key** used by `/api/generate-practice` still bypasses RLS, so the API can insert and read without policies.

If you use other clients (e.g. authenticated users) to read this table and RLS is enabled, add policies so the server or those clients can access rows. For example:

```sql
alter table lesson_practice enable row level security;

-- Allow server/backend inserts (e.g. when using service role or a dedicated role)
create policy "Allow server inserts"
on lesson_practice
for insert
to authenticated
with check (true);

-- Allow reads
create policy "Allow reads"
on lesson_practice
for select
to authenticated
using (true);
```

Adjust `to authenticated` / role names to match your Supabase roles. The Next.js API uses **service role**, so it does not require these policies to write or read.

---

## 3. Verify

- In Supabase: **Table Editor** → `lesson_practice` should exist with columns `lesson_id`, `questions_json`, `created_at`.
- After creating the table, run Practice again; the terminal will log the real Supabase error if something still fails (e.g. permissions or schema mismatch).
