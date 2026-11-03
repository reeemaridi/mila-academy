-- Photos and legal papers (ID card, passport, civil record) for students and
-- for staff accounts. Run once in the Supabase SQL Editor.
--
-- PRIVATE by design: files live in a non-public bucket and the table has RLS
-- on with no policies, so the only way in is the app's own API routes, which
-- check who is asking before streaming a file.

create table if not exists person_documents (
  id            uuid primary key default gen_random_uuid(),
  owner_type    text not null check (owner_type in ('student', 'user')),
  owner_id      uuid not null,
  doc_type      text not null check (doc_type in ('photo', 'id_card', 'passport', 'civil_record', 'other')),
  label         text not null default '',
  file_name     text not null,
  mime_type     text not null,
  size_bytes    integer not null,
  storage_path  text not null unique,
  uploaded_by   uuid references app_users(id) on delete set null,
  uploaded_at   timestamptz not null default now()
);
create index if not exists idx_person_documents_owner on person_documents (owner_type, owner_id);
alter table person_documents enable row level security;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'documents', 'documents', false, 4194304,
  array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
)
on conflict (id) do nothing;
