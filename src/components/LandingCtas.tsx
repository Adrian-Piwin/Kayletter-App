"use client";

import Link from "next/link";
import { Show, SignInButton, SignUpButton } from "@clerk/nextjs";
import { track } from "@/lib/analytics";

/** Where an author lands once they're signed in — their notes, not the pitch. */
const AFTER_AUTH = "/notes";

export default function LandingCtas() {
  return (
    <>
      <nav className="flex items-center gap-3">
        <Show when="signed-out">
          {/*
         * Signing in lands on the notes page rather than back here. Both URLs
         * are set because the modal lets you swap to sign-up without closing,
         * and the flow you finish in is the one that picks the redirect.
         */}
        <SignInButton
          mode="modal"
          forceRedirectUrl={AFTER_AUTH}
          signUpForceRedirectUrl={AFTER_AUTH}
        >
            <button
              type="button"
              onClick={() => track("landing_sign_in_clicked")}
              className="font-pixel text-sm px-3 py-1.5 text-ink hover:text-pig-deep cursor-pointer"
            >
              Sign in
            </button>
          </SignInButton>
        </Show>
        <Show when="signed-in">
          <Link
            href="/notes"
            onClick={() => track("landing_my_notes_clicked")}
            className="font-pixel text-sm px-4 py-2 bg-pig-deep text-white border-2 border-ink shadow-[3px_3px_0_0_var(--ink)] hover:bg-[#d96679]"
          >
            My notes
          </Link>
        </Show>
      </nav>
    </>
  );
}

export function LandingHeroCta() {
  return (
    <div className="flex gap-4 mt-2">
      <Show when="signed-out">
        <SignUpButton
          mode="modal"
          forceRedirectUrl={AFTER_AUTH}
          signInForceRedirectUrl={AFTER_AUTH}
        >
          <button
            type="button"
            onClick={() => track("landing_cta_clicked", { cta: "write_first_note" })}
            className="font-pixel text-base px-6 py-3 bg-pig-deep text-white border-2 border-ink shadow-[4px_4px_0_0_var(--ink)] active:shadow-none active:translate-x-1 active:translate-y-1 hover:bg-[#d96679] cursor-pointer"
          >
            Write your first note
          </button>
        </SignUpButton>
      </Show>
      <Show when="signed-in">
        <Link
          href="/notes"
          onClick={() => track("landing_cta_clicked", { cta: "write_a_note" })}
          className="font-pixel text-base px-6 py-3 bg-pig-deep text-white border-2 border-ink shadow-[4px_4px_0_0_var(--ink)] active:shadow-none active:translate-x-1 active:translate-y-1 hover:bg-[#d96679]"
        >
          Write a note
        </Link>
      </Show>
    </div>
  );
}
