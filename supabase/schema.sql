-- Kayletter schema
-- All app access goes through the server with a direct Postgres connection;
-- RLS is enabled with no policies so the Data API (anon/authenticated roles)
-- can never read these tables.

create table if not exists profiles (
  clerk_user_id text primary key,
  email text not null,
  is_premium boolean not null default false,
  stripe_customer_id text,
  legacy_firebase_uid text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists letters (
  id uuid primary key default gen_random_uuid(),
  owner_clerk_id text references profiles(clerk_user_id) on delete set null,
  share_token text not null unique,
  -- 10-char code from the old Firebase site, kept so old links redirect
  legacy_display_id text unique,
  title text not null default 'A letter for you',
  pet_name text not null default 'Truffle',
  -- email of the legacy author; letter is auto-claimed when they sign up with it
  claim_email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists letters_owner_idx on letters(owner_clerk_id);
create index if not exists letters_claim_email_idx on letters(claim_email);

create table if not exists notes (
  id uuid primary key default gen_random_uuid(),
  letter_id uuid not null references letters(id) on delete cascade,
  content text not null,
  position int not null default 0,
  created_at timestamptz not null default now(),
  read_at timestamptz,
  is_favorite boolean not null default false
);
create index if not exists notes_letter_idx on notes(letter_id, position);

create table if not exists pets (
  letter_id uuid primary key references letters(id) on delete cascade,
  happiness int not null default 70 check (happiness between 0 and 100),
  hunger int not null default 30 check (hunger between 0 and 100),
  last_fed_at timestamptz,
  last_played_at timestamptz,
  tricks_unlocked int not null default 0,
  updated_at timestamptz not null default now()
);

alter table profiles enable row level security;
alter table letters enable row level security;
alter table notes enable row level security;
alter table pets enable row level security;
