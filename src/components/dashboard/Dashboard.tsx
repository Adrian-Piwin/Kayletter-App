"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { UserButton } from "@clerk/nextjs";
import PixelButton from "@/components/PixelButton";
import Pagination, { usePagination } from "@/components/Pagination";
import Sprite from "@/components/Sprite";
import PigStill from "@/components/PigStill";
import { PIG_CLIPS } from "@/lib/pig-anim.generated";
import NoteCard from "./NoteCard";
import NoteComposer from "./NoteComposer";
import { analyticsFetch, track } from "@/lib/analytics";
import { useOrigin } from "@/lib/hooks";
import { FREE_NOTE_LIMIT, NOTES_PER_PAGE } from "@/lib/plan";
import type { Letter, Note } from "@/lib/types";

const cardClass = "bg-white border-2 border-ink shadow-[4px_4px_0_0_var(--ink)] p-4";

export default function Dashboard({
  letter,
  initialNotes,
  isPremium,
}: {
  letter: Letter;
  initialNotes: Note[];
  isPremium: boolean;
}) {
  const [notes, setNotes] = useState(initialNotes);
  const [title, setTitle] = useState(letter.title);
  const [petName, setPetName] = useState(letter.pet_name);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [composerInView, setComposerInView] = useState(true);
  const composerRef = useRef<HTMLDivElement>(null);
  const draftRef = useRef<HTMLTextAreaElement>(null);
  const origin = useOrigin();

  const shareUrl = `${origin}/l/${letter.share_token}`;
  const atLimit = !isPremium && notes.length >= FREE_NOTE_LIMIT;
  const readCount = notes.filter((n) => n.read_at).length;
  const { page, pageCount, start, visible, setPage, goToIndex } = usePagination(
    notes,
    NOTES_PER_PAGE
  );

  useEffect(() => {
    track("dashboard_viewed", {
      note_count: notes.length,
      notes_delivered: readCount,
      is_premium: isPremium,
      at_limit: atLimit,
    });
    // Capture initial dashboard state once per visit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("upgraded") === "1") {
      track("upgrade_success_viewed");
      showToast("Upgrade complete — unlimited notes unlocked!");
      window.history.replaceState({}, "", "/notes");
    }
  }, []);

  // The shortcut button only appears once the composer has scrolled away.
  useEffect(() => {
    const el = composerRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(([entry]) => setComposerInView(entry.isIntersecting));
    observer.observe(el);
    return () => observer.disconnect();
  }, [atLimit]);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  }

  function jumpToComposer() {
    composerRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    draftRef.current?.focus({ preventScroll: true });
    track("note_composer_shortcut_clicked", { note_count: notes.length });
  }

  async function saveSettings() {
    setBusy(true);
    const res = await analyticsFetch("/api/letter", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, pet_name: petName }),
    });
    setBusy(false);
    if (res.ok) track("letter_settings_saved");
    showToast(res.ok ? "Saved!" : "Couldn't save settings");
  }

  async function addNote(content: string) {
    setBusy(true);
    const res = await analyticsFetch("/api/notes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content }),
    });
    setBusy(false);
    if (res.ok) {
      const { note } = await res.json();
      setNotes((n) => [...n, note]);
      // A new note lands at the end of the list; follow it so it's visible.
      goToIndex(notes.length);
      track("note_created_client", {
        note_count: notes.length + 1,
        content_length: note.content.length,
        is_premium: isPremium,
      });
      return true;
    }
    if (res.status === 402) {
      track("note_limit_hit_client", { note_count: notes.length });
      showToast("Free limit reached — upgrade for unlimited notes");
    } else {
      showToast("Couldn't add note");
    }
    return false;
  }

  async function saveEdit(id: string, content: string) {
    const res = await analyticsFetch(`/api/notes/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content }),
    });
    if (res.ok) {
      const { note } = await res.json();
      setNotes((ns) => ns.map((n) => (n.id === id ? note : n)));
      setEditingId(null);
      track("note_edited");
    } else {
      showToast("Couldn't save note");
    }
  }

  async function removeNote(id: string) {
    const res = await analyticsFetch(`/api/notes/${id}`, { method: "DELETE" });
    if (res.ok) {
      setNotes((ns) => ns.filter((n) => n.id !== id));
      track("note_deleted");
    } else showToast("Couldn't delete note");
  }

  async function upgrade() {
    track("upgrade_clicked", {
      note_count: notes.length,
      source: atLimit ? "limit_banner" : "manual",
    });
    setBusy(true);
    const res = await analyticsFetch("/api/checkout", { method: "POST" });
    setBusy(false);
    if (res.ok) {
      const { url } = await res.json();
      window.location.href = url;
    } else {
      showToast("Couldn't start checkout");
    }
  }

  function copyLink() {
    navigator.clipboard.writeText(shareUrl);
    track("share_link_copied", { note_count: notes.length, notes_delivered: readCount });
    showToast("Link copied — send it to your favorite person");
  }

  return (
    <main className="flex-1 w-full max-w-3xl mx-auto px-4 sm:px-6 py-4 sm:py-6 flex flex-col gap-4 sm:gap-6">
      <header className="flex items-center justify-between gap-3">
        <Link href="/" className="font-pixel text-lg sm:text-xl text-pig-deep">
          Kayletter
        </Link>
        <div className="flex items-center gap-3">
          {isPremium && (
            <span className="font-pixel text-xs bg-sunflower border-2 border-ink px-2 py-1">
              unlimited
            </span>
          )}
          <UserButton />
        </div>
      </header>

      {/* Notes come first so writing one is always the top of the page */}
      <section className={`${cardClass} flex flex-col gap-4`}>
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <h2 className="font-pixel text-base text-ink">Your notes</h2>
          <span className="text-xs sm:text-sm text-ink/60">
            {readCount}/{notes.length} delivered
            {!isPremium && ` · ${Math.max(0, FREE_NOTE_LIMIT - notes.length)} free left`}
          </span>
        </div>

        <div ref={composerRef}>
          {atLimit ? (
            <div className="border-2 border-ink bg-sunflower/40 p-4 flex flex-col sm:flex-row items-center gap-3 text-center sm:text-left">
              <Sprite name="strawberry" alt="" height={40} />
              <p className="flex-1 text-sm text-ink">
                You&apos;ve used your {FREE_NOTE_LIMIT} free notes. Unlock unlimited notes forever
                for a single dollar.
              </p>
              <PixelButton
                onClick={upgrade}
                disabled={busy}
                className="w-full sm:w-auto min-h-11 shrink-0"
              >
                Upgrade — $1
              </PixelButton>
            </div>
          ) : (
            <NoteComposer ref={draftRef} onSubmit={addNote} busy={busy} />
          )}
        </div>

        {notes.length === 0 ? (
          <p className="text-center text-ink/50 py-4">
            No notes yet — write the first thing you want them to read.
          </p>
        ) : (
          <>
            <ul className="flex flex-col gap-3">
              {visible.map((note, i) => (
                <NoteCard
                  key={note.id}
                  note={note}
                  number={start + i + 1}
                  isEditing={editingId === note.id}
                  onEditStart={() => setEditingId(note.id)}
                  onEditCancel={() => setEditingId(null)}
                  onSave={(content) => saveEdit(note.id, content)}
                  onDelete={() => removeNote(note.id)}
                />
              ))}
            </ul>
            <Pagination page={page} pageCount={pageCount} onChange={setPage} label="notes" />
          </>
        )}
      </section>

      {/* Share link */}
      <section className={`${cardClass} flex flex-col sm:flex-row sm:items-center gap-3`}>
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <PigStill
            clip={"idle_letter" in PIG_CLIPS ? "idle_letter" : "idle_breathe"}
            alt=""
            height={56}
            className="shrink-0"
          />
          <div className="min-w-0">
            <h2 className="font-pixel text-base text-ink">Their secret garden link</h2>
            <p className="font-pixel-body text-lg text-ink/60 truncate">{shareUrl}</p>
          </div>
        </div>
        <PixelButton
          variant="sunflower"
          onClick={copyLink}
          className="w-full sm:w-auto min-h-11 shrink-0"
        >
          Copy link
        </PixelButton>
      </section>

      {/* Settings */}
      <section className={`${cardClass} flex flex-col gap-3`}>
        <h2 className="font-pixel text-base text-ink">Garden settings</h2>
        <div className="grid sm:grid-cols-2 gap-3">
          <label className="flex flex-col gap-1 text-sm text-ink/70">
            Page title
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={80}
              className="border-2 border-ink px-3 py-2 text-base bg-cream focus:outline-none focus:bg-white"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm text-ink/70">
            Pig&apos;s name
            <input
              value={petName}
              onChange={(e) => setPetName(e.target.value)}
              maxLength={24}
              className="border-2 border-ink px-3 py-2 text-base bg-cream focus:outline-none focus:bg-white"
            />
          </label>
        </div>
        <PixelButton
          variant="leaf"
          onClick={saveSettings}
          disabled={busy}
          className="w-full sm:w-auto sm:self-start min-h-11"
        >
          Save settings
        </PixelButton>
      </section>

      {/* Jump back to the composer from anywhere on the page */}
      {!atLimit && !composerInView && (
        <button
          onClick={jumpToComposer}
          className="fixed bottom-5 right-4 sm:right-6 z-40 font-pixel text-sm min-h-12 px-4 bg-pig-deep text-white border-2 border-ink shadow-[4px_4px_0_0_var(--ink)] active:shadow-none active:translate-x-[4px] active:translate-y-[4px] transition-[transform,box-shadow] duration-100 cursor-pointer touch-manipulation"
        >
          ✎ new note
        </button>
      )}

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 max-w-[90vw] text-center bg-ink text-cream font-pixel text-sm px-4 py-2 border-2 border-ink shadow-[3px_3px_0_0_rgba(0,0,0,0.3)] z-50">
          {toast}
        </div>
      )}
    </main>
  );
}
