# Changelog

## [0.2.0] - 2026-08-01

### Make the app mobile-friendly with note pagination and a top composer

Notes are easier to write and browse on phones; every page scales better on small screens.

#### Changes
- Move the note composer above the list and add a floating shortcut when it scrolls away.
- Paginate author notes and the recipient mailbox so long stacks stay scannable.
- Tighten mobile layouts across landing, dashboard, garden, and modals (tap targets, wrapping HUD, `svh`).

##### **dashboard**
- Composer-first notes section with pagination (5 per page) and delete confirmation.
- Shared `NoteComposer` / `NoteCard` components and floating “new note” button.

##### **garden**
- Wrapping top bar so title, pet HUD, and mailbox no longer overlap on narrow screens.
- Fewer, smaller sunflowers on mobile; action bar and status chip clear each other.
- Mailbox and letter modal use larger touch targets and stay within the viewport.

##### **shared**
- Reusable `Pagination` / `usePagination`, client hooks (`useOrigin`, `useMediaQuery`).
- `MAX_NOTE_LENGTH` and `NOTES_PER_PAGE` constants shared with the notes API.
