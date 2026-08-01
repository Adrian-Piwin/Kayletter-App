#!/usr/bin/env node
/**
 * Resumable migration: Firebase (Firestore + Auth) -> Supabase Postgres.
 *
 * Old schema: `users/{uid}` -> { displayId }, plus one top-level collection
 * per displayId containing a `variables` doc (pageTitle, imageURL) and note
 * docs ({ note, createdOn, readOn, read, isFavorite }).
 *
 * Designed for the free Firestore plan (50k reads/day):
 *  - Auth users + `users` mapping are cached locally after the first run.
 *  - Claimed pages (a registered author exists) migrate first.
 *  - Progress is checkpointed; on quota exhaustion the script exits cleanly
 *    and picks up where it left off on the next run.
 *
 * Usage: DATABASE_URL=... node scripts/migrate-firebase.mjs [--dry-run]
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { config } from "dotenv";
import { initializeApp, cert } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import postgres from "postgres";

config({ path: ".env.local" });

const DRY_RUN = process.argv.includes("--dry-run");
const SERVICE_ACCOUNT_PATH = "auth/luckygame-1905f-firebase-adminsdk-ij7e9-4d82698a19.json";
const CACHE_PATH = "auth/migration-cache.json";
const CHECKPOINT_PATH = "auth/migration-checkpoint.json";

const TOKEN_ALPHABET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-_";
const newShareToken = (length = 24) =>
  Array.from(randomBytes(length), (b) => TOKEN_ALPHABET[b % TOKEN_ALPHABET.length]).join("");

const isQuotaError = (err) => err?.code === 8 || /quota exceeded/i.test(String(err?.message));

initializeApp({
  credential: cert(JSON.parse(readFileSync(SERVICE_ACCOUNT_PATH, "utf8"))),
});
const firestore = getFirestore();

const sql = DRY_RUN ? null : postgres(process.env.DATABASE_URL, { max: 3, prepare: false });

/** Auth emails + users-collection mapping, cached to disk after first read. */
async function loadMetadata() {
  if (existsSync(CACHE_PATH)) {
    console.log("Using cached auth/users metadata");
    return JSON.parse(readFileSync(CACHE_PATH, "utf8"));
  }

  const uidToEmail = {};
  let pageToken;
  do {
    const res = await getAuth().listUsers(1000, pageToken);
    for (const u of res.users) if (u.email) uidToEmail[u.uid] = u.email;
    pageToken = res.pageToken;
  } while (pageToken);

  const displayIdToEmail = {};
  const usersSnap = await firestore.collection("users").get();
  for (const doc of usersSnap.docs) {
    const displayId = doc.data().displayId;
    const email = uidToEmail[doc.id];
    if (displayId && email) displayIdToEmail[displayId] = email;
  }

  const cache = { displayIdToEmail };
  writeFileSync(CACHE_PATH, JSON.stringify(cache));
  console.log(
    `Cached metadata: ${Object.keys(uidToEmail).length} auth emails, ${Object.keys(displayIdToEmail).length} claimed pages`
  );
  return cache;
}

function loadCheckpoint() {
  if (existsSync(CHECKPOINT_PATH)) return JSON.parse(readFileSync(CHECKPOINT_PATH, "utf8"));
  return { done: {}, phase: "claimed", stats: { letters: 0, notes: 0, empty: 0 } };
}

const saveCheckpoint = (cp) => writeFileSync(CHECKPOINT_PATH, JSON.stringify(cp));

async function migratePage(displayId, claimEmail, cp) {
  const docs = await firestore.collection(displayId).get();
  const variables = docs.docs.find((d) => d.id === "variables")?.data() ?? {};
  const noteDocs = docs.docs
    .filter((d) => d.id !== "variables" && typeof d.data().note === "string")
    .sort((a, b) => (a.data().createdOn ?? 0) - (b.data().createdOn ?? 0));

  if (noteDocs.length === 0) {
    cp.done[displayId] = "empty";
    cp.stats.empty++;
    return;
  }

  const title = (variables.pageTitle || "A letter for you").slice(0, 80);

  if (!DRY_RUN) {
    const existing = await sql`select id from letters where legacy_display_id = ${displayId}`;
    if (existing.length) {
      cp.done[displayId] = "exists";
      return;
    }

    const [letter] = await sql`
      insert into letters (share_token, legacy_display_id, title, claim_email)
      values (${newShareToken()}, ${displayId}, ${title}, ${claimEmail})
      returning id
    `;
    const rows = noteDocs.map((d, i) => {
      const data = d.data();
      return {
        letter_id: letter.id,
        content: data.note,
        position: i,
        created_at: new Date(data.createdOn ?? Date.now()),
        read_at: data.read && data.readOn ? new Date(data.readOn) : null,
        is_favorite: !!data.isFavorite,
      };
    });
    await sql`insert into notes ${sql(rows)}`;
    await sql`insert into pets (letter_id) values (${letter.id}) on conflict do nothing`;
  }

  cp.done[displayId] = "ok";
  cp.stats.letters++;
  cp.stats.notes += noteDocs.length;
}

async function main() {
  const { displayIdToEmail } = await loadMetadata();
  const cp = loadCheckpoint();
  let processed = 0;

  const run = async (displayId, claimEmail) => {
    if (cp.done[displayId]) return;
    await migratePage(displayId, claimEmail, cp);
    processed++;
    if (processed % 25 === 0) {
      saveCheckpoint(cp);
      console.log(
        `progress: ${cp.stats.letters} letters, ${cp.stats.notes} notes (this run: ${processed})`
      );
    }
  };

  try {
    // Phase 1: claimed pages (registered authors) — the users who matter most.
    if (cp.phase === "claimed") {
      console.log("Phase 1: claimed pages");
      for (const [displayId, email] of Object.entries(displayIdToEmail)) {
        await run(displayId, email);
      }
      cp.phase = "unclaimed";
      saveCheckpoint(cp);
      console.log("Phase 1 complete");
    }

    // Phase 2: everything else, discovered via listCollections.
    console.log("Phase 2: unclaimed legacy pages");
    const collections = await firestore.listCollections();
    for (const col of collections) {
      if (col.id === "users") continue;
      await run(col.id, displayIdToEmail[col.id] ?? null);
    }
    cp.phase = "complete";
    saveCheckpoint(cp);
    console.log("\nMigration COMPLETE.");
  } catch (err) {
    saveCheckpoint(cp);
    if (isQuotaError(err)) {
      console.log(
        `\nDaily Firestore quota exhausted — checkpoint saved. Re-run tomorrow to resume. ` +
          `(so far: ${cp.stats.letters} letters, ${cp.stats.notes} notes)`
      );
    } else {
      console.error("\nStopped on error (checkpoint saved):", err.message);
      process.exitCode = 1;
    }
  }

  console.log(
    `Totals: ${cp.stats.letters} letters, ${cp.stats.notes} notes, ${cp.stats.empty} empty pages skipped${DRY_RUN ? " (dry run)" : ""}`
  );
  if (sql) await sql.end();
  process.exit(process.exitCode ?? 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
