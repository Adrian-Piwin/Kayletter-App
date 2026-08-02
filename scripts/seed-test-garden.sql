-- Throwaway fixtures for eyeballing the garden scene at different sizes.
-- Intended for a local scratch database, never for production.

delete from letters where share_token like 'test-%';

insert into letters (share_token, title, pet_name) values
  ('test-tiny', 'a tiny garden', 'Truffle'),
  ('test-small', 'five letters', 'Truffle'),
  ('test-medium', 'forty letters', 'Truffle'),
  ('test-huge', 'two hundred letters', 'Truffle');

insert into pets (letter_id, tricks_unlocked)
select id, 3 from letters where share_token like 'test-%';

-- Every note is already read, and old enough to have bloomed, apart from a
-- recent tail so all three growth stages show up. Every seventh is favourited.
insert into notes (letter_id, content, position, created_at, read_at, is_favorite)
select
  l.id,
  'Test letter ' || i || ' — a little note to see how the garden fills out.',
  i,
  now() - make_interval(days => n.total - i),
  now() - make_interval(hours => (n.total - i) * 24),
  i % 7 = 0
from letters l
join (values ('test-tiny', 1), ('test-small', 5), ('test-medium', 40), ('test-huge', 200))
  as n(token, total) on n.token = l.share_token
cross join lateral generate_series(1, n.total) as i;
