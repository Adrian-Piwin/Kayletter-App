# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Commands

```bash
npm run dev      # next dev
npm run build    # next build (output: "standalone")
npm run lint     # eslint — CI runs this before build, so a lint error blocks deploy
npm run sprites  # rebuild the pig atlas from PixelLab output (python3 + Pillow)
```

There is no test suite. Verification is lint + build, plus `scripts/pig/review.py` for sprite work.

Local Postgres for development (schema in `supabase/schema.sql`, incremental changes in
`supabase/migrations/`):

```bash
docker run -d --name kayletter-pg -e POSTGRES_PASSWORD=kayletter -e POSTGRES_DB=kayletter -p 54329:5432 postgres:17
docker exec -i kayletter-pg psql -U postgres -d kayletter < supabase/schema.sql
```

Pushing to `main` deploys (GitHub Actions → rsync standalone bundle to a DigitalOcean droplet →
pm2 reload). Push only when asked.

## Framework notes

Next.js 16 + React 19. Beyond the `AGENTS.md` rule to read `node_modules/next/dist/docs/`, two
things in this repo that will look wrong from memory:

- **`src/proxy.ts` is the middleware.** Next 16 renamed it; Clerk's `clerkMiddleware` lives there.
  Only `/notes` and the author APIs are protected — the landing page, `/l/*` and legacy redirects
  are public.
- `useEffectEvent` (React 19.2) is used in `useSpriteAnimation`; `react-hooks/purity` lint rules
  are live (see the `Date.now()` suppression in `src/app/l/[token]/page.tsx`).

## Architecture

Two audiences share one database row graph:

- **Author** signs in with Clerk at `/notes`, writes notes, shares `/l/<share_token>`.
- **Recipient** needs no account — the 24-char `nanoid` token *is* the credential.

`profiles` (keyed by `clerk_user_id`) → one `letters` row per author → many `notes` (ordered by
`position`) + one `pets` row. An author's letter is created lazily on first visit by
`getAuthorContext()` ([src/lib/author.ts](src/lib/author.ts)).

### Data access is server-only, by design

Every table has RLS enabled with **no policies**, so Supabase's Data API can never read them. All
access goes through a direct `postgres.js` connection ([src/lib/db.ts](src/lib/db.ts)) from
[src/lib/data.ts](src/lib/data.ts), which is marked `import "server-only"`. Never add a browser
Supabase client or a policy that would open the Data API. `prepare: false` is required for the
Supabase pooler.

Authorization is expressed inside the SQL rather than as a separate check — updates carry
`and owner_clerk_id = ${...}` / `and letter_id = ${...}` / `and read_at is null` in their `where`
clause and return `null` when they match nothing. Keep new mutations in that shape.

### Derived state, not stored state

Several things a database would normally store are computed from the notes:

- **Unlock cadence** ([src/lib/unlock.ts](src/lib/unlock.ts)) — first note is free; each later one
  unlocks 24h after the previous `read_at`.
- **Pet stats** ([src/lib/pet.ts](src/lib/pet.ts)) — happiness/hunger decay from `updated_at` at
  read time (`decayedStats`), so the row is only written on interaction. Tricks unlocked = read
  notes / 2.
- **Flower stage** ([src/lib/garden-layout.ts](src/lib/garden-layout.ts)) — a note's sunflower
  grows with the age of its `read_at`; favorites bloom immediately.

The recipient page passes `serverNow` into the client so first client render matches SSR.

### Legacy Firebase site

The predecessor site is still linked from the wild. `/display.html?displayId=…` resolves via
`letters.legacy_display_id`, and a migrated letter with a matching `claim_email` is relinked to
its author the first time they sign in (`ensureProfile`). `scripts/migrate-firebase.mjs` was the
one-time import. Don't drop those columns or the `display.html` route.

### The garden scene

[src/components/garden/](src/components/garden/) is the bulk of the client code and the part most
likely to be broken by a naive change:

- `planField()` lays out a side-scrolling world of parallax depth rows. The constants at the top of
  `garden-layout.ts` are interdependent — the pig's depth is chosen so its parallax factor is
  exactly 1 (it holds position while the world slides), and rows stop short of the pig so no flower
  stands in front of it. Read the comments before tuning numbers.
- `useCamera` keeps camera position **outside React** — layers subscribe and write their own
  transforms, so panning never re-renders the field. Elements marked `data-no-pan` (the pig) keep
  their drags.
- Action timing is scheduled from the click, not the API response, so a slow round-trip can't
  desync the animation.

### Pig sprites

The pig is one atlas (`public/sprites/pig/pig-v2.png`) plus
**[src/lib/pig-anim.generated.ts](src/lib/pig-anim.generated.ts) — auto-generated, never edit it
by hand**. Frame counts, timings, loop flags and chew beats all come from that manifest; the app
must not restate them (see `chompTimes`). `SpriteSheet` renders a frame via `background-position`.

`npm run sprites` runs download → derive → build → review over `assets/pixellab/`, and **ends on
`review.py`, which exits non-zero on a bad clip**. Before touching this pipeline read
[docs/pig-sprite-rework.md](docs/pig-sprite-rework.md) (why two earlier approaches failed) and
[docs/pixellab-notes.md](docs/pixellab-notes.md) (the generation recipe). The 8-colour palette in
`scripts/pig/palette.py` is locked and enforced by the build.

Gotcha worth remembering: a fixed-`height` `<img>` inside an absolutely positioned wrapper
collapses to zero width under Tailwind preflight — `Sprite` sets `max-w-none`.

### Analytics

PostHog is proxied through `/ingest` (rewrites in `next.config.ts`). Client calls that should be
attributable server-side use `analyticsFetch()` ([src/lib/analytics.ts](src/lib/analytics.ts)),
which forwards `X-POSTHOG-DISTINCT-ID` / `X-POSTHOG-SESSION-ID`; API routes read them back via
[src/lib/posthog-server.ts](src/lib/posthog-server.ts). Authors are identified by `clerk_user_id`
on both sides; recipients fall back to `recipient:<token>`. `track()` swallows errors — analytics
must never break a product flow.

## Conventions

- Import via `@/*` (maps to `src/*`).
- Tunable numbers live as named `const`s with a comment explaining the choice, usually in
  `src/lib/*`, not inline in components. Follow that when adding one.
- Product limits (`FREE_NOTE_LIMIT`, `MAX_NOTE_LENGTH`, …) live in [src/lib/plan.ts](src/lib/plan.ts)
  and are enforced in the API route as well as the UI.
- Comments here explain *why*, and several encode hard-won constraints. Don't strip them when
  editing nearby code.

## Committing

Follow [VERSIONING.md](VERSIONING.md): update `CHANGELOG.md` under the current in-progress version
on every commit (append a subsection if the version already has one), bump `package.json` only when
promoting MAJOR/MINOR, and bump patch after a ship. The commit message is that entry's short title.
