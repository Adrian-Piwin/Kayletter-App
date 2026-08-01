import "server-only";
import { PostHog } from "posthog-node";

let posthogClient: PostHog | null = null;

export function getPostHogClient() {
  if (!posthogClient) {
    posthogClient = new PostHog(process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN!, {
      host: process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://us.i.posthog.com",
      flushAt: 1,
      flushInterval: 0,
    });
  }
  return posthogClient;
}

/** Capture a server event and flush immediately (serverless-safe). */
export async function captureServerEvent(
  distinctId: string,
  event: string,
  properties?: Record<string, unknown>
) {
  const token = process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN;
  if (!token || !distinctId) return;

  const posthog = getPostHogClient();
  posthog.capture({ distinctId, event, properties });
  await posthog.flush();
}

/** Prefer the browser session id so client + server events stitch to one person. */
export function distinctIdFromRequest(req: Request, fallback: string) {
  return req.headers.get("x-posthog-distinct-id")?.trim() || fallback;
}

export function sessionIdFromRequest(req: Request) {
  return req.headers.get("x-posthog-session-id")?.trim() || undefined;
}
