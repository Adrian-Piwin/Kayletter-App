-- Petting grants +1 happiness with a 60s server-side cooldown.
alter table pets add column if not exists last_petted_at timestamptz;
