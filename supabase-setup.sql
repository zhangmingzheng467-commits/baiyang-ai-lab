-- Baiyang AI Lab cloud submission setup
-- Admin email: zhangmingzheng467@gmail.com
-- 2. Run this in Supabase SQL Editor.
-- 3. Create an Auth user with the same email/password for admin review.

create extension if not exists "pgcrypto";

create table if not exists public.work_submissions (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  type text not null,
  url text default '',
  summary text not null,
  description text default '',
  tools text[] default '{}',
  images text[] default '{}',
  author text not null,
  wechat text not null,
  city text default '',
  bio text default '',
  join_group text not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  accent text default '#b93627',
  glyph text default '',
  created_at timestamptz not null default now()
);

create table if not exists public.works_public (
  id uuid primary key,
  title text not null,
  type text not null,
  url text default '',
  summary text not null,
  description text default '',
  tools text[] default '{}',
  images text[] default '{}',
  author text not null,
  city text default '',
  bio text default '',
  status text not null default 'approved',
  accent text default '#b93627',
  glyph text default '',
  created_at timestamptz not null default now()
);

alter table public.work_submissions enable row level security;
alter table public.works_public enable row level security;

drop policy if exists "Anyone can submit works" on public.work_submissions;
create policy "Anyone can submit works"
on public.work_submissions
for insert
to anon
with check (status = 'pending');

drop policy if exists "Admin can read submissions" on public.work_submissions;
create policy "Admin can read submissions"
on public.work_submissions
for select
to authenticated
using (auth.jwt() ->> 'email' = 'zhangmingzheng467@gmail.com');

drop policy if exists "Admin can update submissions" on public.work_submissions;
create policy "Admin can update submissions"
on public.work_submissions
for update
to authenticated
using (auth.jwt() ->> 'email' = 'zhangmingzheng467@gmail.com')
with check (auth.jwt() ->> 'email' = 'zhangmingzheng467@gmail.com');

drop policy if exists "Anyone can read approved public works" on public.works_public;
create policy "Anyone can read approved public works"
on public.works_public
for select
to anon, authenticated
using (status = 'approved');

drop policy if exists "Admin can publish public works" on public.works_public;
create policy "Admin can publish public works"
on public.works_public
for insert
to authenticated
with check (auth.jwt() ->> 'email' = 'zhangmingzheng467@gmail.com');

drop policy if exists "Admin can update public works" on public.works_public;
create policy "Admin can update public works"
on public.works_public
for update
to authenticated
using (auth.jwt() ->> 'email' = 'zhangmingzheng467@gmail.com')
with check (auth.jwt() ->> 'email' = 'zhangmingzheng467@gmail.com');

drop policy if exists "Admin can remove public works" on public.works_public;
create policy "Admin can remove public works"
on public.works_public
for delete
to authenticated
using (auth.jwt() ->> 'email' = 'zhangmingzheng467@gmail.com');

insert into storage.buckets (id, name, public)
values ('work-images', 'work-images', true)
on conflict (id) do update set public = true;

drop policy if exists "Anyone can upload work images" on storage.objects;
create policy "Anyone can upload work images"
on storage.objects
for insert
to anon, authenticated
with check (bucket_id = 'work-images');

drop policy if exists "Anyone can read work images" on storage.objects;
create policy "Anyone can read work images"
on storage.objects
for select
to anon, authenticated
using (bucket_id = 'work-images');
