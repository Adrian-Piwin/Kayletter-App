# Versioning, changelog, and commits

This file tells agents (and humans) how this repo versions, records changes,
and releases. Keep it accurate when conventions change.

## Semantic versioning

Canonical version file: `package.json`

Format: `MAJOR.MINOR.PATCH` (e.g. `0.2.0`)

| Part | When to bump |
|------|----------------|
| **MAJOR** | Breaking change for users or stored data (rare) |
| **MINOR** | New backward-compatible user-facing capability (reset patch to `0`) |
| **PATCH** | Bug fixes, polish, copy, internal-only — usually after a ship |

### Release cycle

The canonical version is the **in-progress release**. Many commits share it.

| When | Version behavior |
|------|------------------|
| Commit | Do **not** bump by default; append changelog under the current version |
| Promote | Bump MAJOR/MINOR only when this cycle needs a higher level |
| Deploy | Pushing `main` ships via `.github/workflows/deploy.yml`; then bump **patch** for the next cycle when starting post-ship polish |

## Changelog

Path: `CHANGELOG.md`

- Always update when committing (version number may stay the same).
- One top-level `## [VERSION]` section per in-progress version; append
  subsections for later commits on the same version.
- Date format: `YYYY-MM-DD`.
- Commit message = this commit’s short description.

### Entry template

```markdown
## [0.2.0] - 2026-08-01

### Short title for this commit

Very short description of what was changed (use this as commit message)

#### Changes
- Overall project-relevant bullets.

##### **area**
- Bullets only for areas actually touched.
```

## User-facing release notes

Path: none yet

Skip for now. If a user-facing notes store is added later, document it here
and keep **one entry per version** with concise bullets users would notice.

## Commit workflow

1. Read the canonical version (target for this commit’s notes).
2. Bump only when promoting MAJOR/MINOR for this cycle.
3. Update the changelog under that version (append subsection if it exists).
4. Update release notes when a store exists and changes are user-facing.
5. Stage only session files plus version / changelog / this doc if changed.
6. Commit with this commit’s short description.
7. Push: only when asked

## Upload / release workflow

Deploy happens automatically on push to `main` (GitHub Actions → droplet via
pm2). After a successful ship, bump **patch** so the next polish commit
targets a new in-progress version. Do not auto-commit unless asked.
