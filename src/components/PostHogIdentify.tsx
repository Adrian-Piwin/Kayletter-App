"use client";

import { useEffect, useRef } from "react";
import { useAuth, useUser } from "@clerk/nextjs";
import posthog from "posthog-js";

/** Identify signed-in authors in PostHog; reset when they sign out. */
export default function PostHogIdentify() {
  const { isSignedIn, userId } = useAuth();
  const { user } = useUser();
  const wasIdentified = useRef(false);

  useEffect(() => {
    if (isSignedIn && userId) {
      posthog.identify(userId, {
        email: user?.primaryEmailAddress?.emailAddress,
        name: user?.fullName ?? undefined,
      });
      wasIdentified.current = true;
      return;
    }

    // Only reset after a signed-in session — keeps anonymous garden visitors intact.
    if (wasIdentified.current) {
      posthog.reset();
      wasIdentified.current = false;
    }
  }, [isSignedIn, userId, user?.primaryEmailAddress?.emailAddress, user?.fullName]);

  return null;
}
