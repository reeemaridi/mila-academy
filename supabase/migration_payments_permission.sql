-- Lets an administrator allow specific coaches to view payment information
-- (the Payments page and each student's Payments tab, read-only). Off by
-- default. Run once in the Supabase SQL Editor.
alter table app_users add column if not exists can_view_payments boolean not null default false;
