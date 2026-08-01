"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { UserButton } from "@clerk/nextjs";
import PixelButton from "@/components/PixelButton";
import Sprite from "@/components/Sprite";
import { FREE_NOTE_LIMIT } from "@/lib/plan";
import type { Letter, Note } from "@/lib/types";

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
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [origin, setOrigin] = useState("");

  // Set after mount to avoid a server/client hydration mismatch
  useEffect(() => setOrigin(window.location.origin), []);

  const shareUrl = `${origin}/l/${letter.share_token}`;
  const atLimit = !isPremium && notes.length >= FREE_NOTE_LIMIT;
  const readCount = notes.filter((n) => n.read_at).length;

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("upgraded") === "1") {
      showToast("Upgrade complete — unlimited notes unlocked!");
      window.history.replaceState({}, "", "/notes");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  }

  async function saveSettings() {
    setBusy(true);
    const res = await fetch("/api/letter", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, pet_name: petName }),
    });
    setBusy(false);
    showToast(res.ok ? "Saved!" : "Couldn't save settings");
  }

  async function addNote() {
    if (!draft.trim()) return;
    setBusy(true);
    const res = await fetch("/api/notes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: draft }),
    });
    setBusy(false);
    if (res.ok) {
      const { note } = await res.json();
      setNotes((n) => [...n, note]);
      setDraft("");
    } else if (res.status === 402) {
      showToast("Free limit reached — upgrade for unlimited notes");
    } else {
      showToast("Couldn't add note");
    }
  }

  async function saveEdit(id: string) {
    const res = await fetch(`/api/notes/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: editText }),
    });
    if (res.ok) {
      const { note } = await res.json();
      setNotes((ns) => ns.map((n) => (n.id === id ? note : n)));
      setEditingId(null);
    } else {
      showToast("Couldn't save note");
    }
  }

  async function removeNote(id: string) {
    const res = await fetch(`/api/notes/${id}`, { method: "DELETE" });
    if (res.ok) setNotes((ns) => ns.filter((n) => n.id !== id));
    else showToast("Couldn't delete note");
  }

  async function upgrade() {
    setBusy(true);
    const res = await fetch("/api/checkout", { method: "POST" });
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
    showToast("Link copied — send it to your favorite person");
  }

  return (
    <main className="flex-1 max-w-3xl w-full mx-auto px-4 sm:px-6 py-6 flex flex-col gap-6">
      <header className="flex items-center justify-between">
        <Link href="/" className="font-pixel text-xl text-pig-deep">
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

      {/* Share link */}
      <section className="bg-white border-2 border-ink shadow-[4px_4px_0_0_var(--ink)] p-4 flex flex-col sm:flex-row items-start sm:items-center gap-3">
        <Sprite name="pig-envelope" alt="" height={56} />
        <div className="flex-1 min-w-0">
          <h2 className="font-pixel text-base text-ink">Their secret garden link</h2>
          <p className="text-sm text-ink/60 truncate font-pixel-body text-lg">{shareUrl}</p>
        </div>
        <PixelButton variant="sunflower" onClick={copyLink}>
          Copy link
        </PixelButton>
      </section>

      {/* Settings */}
      <section className="bg-white border-2 border-ink shadow-[4px_4px_0_0_var(--ink)] p-4 flex flex-col gap-3">
        <h2 className="font-pixel text-base text-ink">Garden settings</h2>
        <div className="grid sm:grid-cols-2 gap-3">
          <label className="flex flex-col gap-1 text-sm text-ink/70">
            Page title
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={80}
              className="border-2 border-ink px-3 py-2 bg-cream focus:outline-none focus:bg-white"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm text-ink/70">
            Pig&apos;s name
            <input
              value={petName}
              onChange={(e) => setPetName(e.target.value)}
              maxLength={24}
              className="border-2 border-ink px-3 py-2 bg-cream focus:outline-none focus:bg-white"
            />
          </label>
        </div>
        <PixelButton variant="leaf" onClick={saveSettings} disabled={busy} className="self-start">
          Save settings
        </PixelButton>
      </section>

      {/* Notes */}
      <section className="bg-white border-2 border-ink shadow-[4px_4px_0_0_var(--ink)] p-4 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="font-pixel text-base text-ink">Your notes</h2>
          <span className="text-sm text-ink/60">
            {readCount}/{notes.length} delivered
            {!isPremium && ` · ${Math.max(0, FREE_NOTE_LIMIT - notes.length)} free left`}
          </span>
        </div>

        <ul className="flex flex-col gap-3">
          {notes.map((note, i) => (
            <li
              key={note.id}
              className={`border-2 border-ink p-3 ${note.read_at ? "bg-cream" : "bg-white"}`}
            >
              <div className="flex items-center gap-2 mb-1.5">
                <span className="font-pixel text-xs text-ink/50">#{i + 1}</span>
                {note.read_at ? (
                  <span className="font-pixel text-xs bg-leaf text-white px-2 py-0.5 border border-ink">
                    delivered
                  </span>
                ) : (
                  <span className="font-pixel text-xs bg-cream-dark text-ink px-2 py-0.5 border border-ink">
                    waiting
                  </span>
                )}
                {note.is_favorite && (
                  <span className="font-pixel text-xs bg-pig text-ink px-2 py-0.5 border border-ink">
                    ♥ favorited
                  </span>
                )}
                {!note.read_at && (
                  <span className="ml-auto flex gap-2">
                    <button
                      onClick={() => {
                        setEditingId(note.id);
                        setEditText(note.content);
                      }}
                      className="text-xs text-ink/50 hover:text-ink underline cursor-pointer"
                    >
                      edit
                    </button>
                    <button
                      onClick={() => removeNote(note.id)}
                      className="text-xs text-ink/50 hover:text-pig-deep underline cursor-pointer"
                    >
                      delete
                    </button>
                  </span>
                )}
              </div>
              {editingId === note.id ? (
                <div className="flex flex-col gap-2">
                  <textarea
                    value={editText}
                    onChange={(e) => setEditText(e.target.value)}
                    maxLength={2000}
                    rows={3}
                    className="border-2 border-ink px-3 py-2 bg-white focus:outline-none w-full resize-y"
                  />
                  <div className="flex gap-2">
                    <PixelButton variant="leaf" onClick={() => saveEdit(note.id)}>
                      Save
                    </PixelButton>
                    <PixelButton variant="ghost" onClick={() => setEditingId(null)}>
                      Cancel
                    </PixelButton>
                  </div>
                </div>
              ) : (
                <p className="whitespace-pre-wrap text-ink/90">{note.content}</p>
              )}
            </li>
          ))}
          {notes.length === 0 && (
            <li className="text-center text-ink/50 py-6">
              No notes yet — write the first thing you want them to read.
            </li>
          )}
        </ul>

        {atLimit ? (
          <div className="border-2 border-ink bg-sunflower/40 p-4 flex flex-col sm:flex-row items-center gap-3">
            <Sprite name="strawberry" alt="" height={40} />
            <p className="flex-1 text-sm text-ink">
              You&apos;ve used your {FREE_NOTE_LIMIT} free notes. Unlock unlimited notes forever for
              a single dollar.
            </p>
            <PixelButton onClick={upgrade} disabled={busy}>
              Upgrade — $1
            </PixelButton>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              maxLength={2000}
              rows={3}
              placeholder="Write a little letter..."
              className="border-2 border-ink px-3 py-2 bg-cream focus:outline-none focus:bg-white w-full resize-y"
            />
            <PixelButton onClick={addNote} disabled={busy || !draft.trim()} className="self-end">
              Add note
            </PixelButton>
          </div>
        )}
      </section>

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-ink text-cream font-pixel text-sm px-4 py-2 border-2 border-ink shadow-[3px_3px_0_0_rgba(0,0,0,0.3)] z-50">
          {toast}
        </div>
      )}
    </main>
  );
}
