# Kayletter

Little letters, delivered by pig. Write a stack of love notes; a pixel pig delivers one a day
to someone you love, in a garden that grows a sunflower for every letter they read.

## Stack

- **Next.js 16** (App Router, TypeScript, Tailwind 4), standalone output
- **Clerk** — author authentication
- **Supabase Postgres** — data (server-side only via `postgres.js`; RLS enabled with no policies
  so the Data API can never touch the tables)
- **Stripe** — one-time $1 upgrade for unlimited notes (5 free)
- Pixel art sprites in `public/sprites`, animated with CSS

## How it works

- Authors sign in at `/notes`, write notes, and share `/l/<share_token>` (24-char unguessable token).
- Recipients see a pixel garden with a tamagotchi pig (feed / play / tricks). One note unlocks
  every 24 hours; each read note grows a sunflower. Favoriting a note makes its flower bloom.
- Legacy links from the old Firebase site (`/display.html?displayId=...`) redirect via
  `letters.legacy_display_id`. Old authors are relinked when they sign up with the same email
  (`letters.claim_email`).

## Development

```bash
npm install
# local Postgres:
docker run -d --name kayletter-pg -e POSTGRES_PASSWORD=kayletter -e POSTGRES_DB=kayletter -p 54329:5432 postgres:17
docker exec -i kayletter-pg psql -U postgres -d kayletter < supabase/schema.sql
npm run dev
```

Environment (`.env.local`): `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`,
`DATABASE_URL`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `NEXT_PUBLIC_APP_URL`,
`NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN`, `NEXT_PUBLIC_POSTHOG_HOST`.

## Deployment

Pushing to `main` triggers `.github/workflows/deploy.yml`: build on CI, rsync the standalone
bundle to the DigitalOcean droplet (`/root/kayletter-next/app`), reload via pm2. Caddy proxies
kayletter.com to port 3000. Runtime env lives in `/root/kayletter-next/.env` on the droplet.
Deploy also upserts PostHog keys into that `.env` (needed for server-side capture).

Repo secrets: `DROPLET_HOST`, `DROPLET_SSH_KEY`, `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`,
`CLERK_SECRET_KEY`, `NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN`, `NEXT_PUBLIC_POSTHOG_HOST`.

## Scripts

- `scripts/migrate-firebase.mjs [--dry-run]` — one-time Firestore/Auth → Postgres migration
- `scripts/process-sprites.py` — background removal + crop for generated sprite art
