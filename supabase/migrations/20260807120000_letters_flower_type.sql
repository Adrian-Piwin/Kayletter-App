-- Which flower a garden grows. Premium authors can change it; everyone else
-- keeps the sunflower. Unconstrained on purpose: the catalogue lives in the app
-- (src/lib/flowers.ts), and a value it no longer knows about falls back to the
-- sunflower rather than failing the recipient's page.
alter table letters
  add column if not exists flower_type text not null default 'sunflower';
