-- Insurance status on each player (Insured / No insurance). Run once in the
-- Supabase SQL Editor.
alter table students add column if not exists insured boolean not null default false;
