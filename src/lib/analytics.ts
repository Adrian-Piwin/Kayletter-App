import posthog from "posthog-js";

/** Headers so API routes can attribute server events to the same browser person. */
export function posthogHeaders(): Record<string, string> {
  try {
    const distinctId = posthog.get_distinct_id();
    const sessionId = posthog.get_session_id();
    const headers: Record<string, string> = {};
    if (distinctId) headers["X-POSTHOG-DISTINCT-ID"] = distinctId;
    if (sessionId) headers["X-POSTHOG-SESSION-ID"] = sessionId;
    return headers;
  } catch {
    return {};
  }
}

export async function analyticsFetch(input: RequestInfo | URL, init?: RequestInit) {
  const headers = new Headers(init?.headers);
  for (const [key, value] of Object.entries(posthogHeaders())) {
    headers.set(key, value);
  }
  return fetch(input, { ...init, headers });
}

export function track(event: string, properties?: Record<string, unknown>) {
  try {
    posthog.capture(event, properties);
  } catch {
    // Analytics must never break product flows.
  }
}
