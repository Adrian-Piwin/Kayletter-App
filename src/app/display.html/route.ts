import { NextResponse } from "next/server";
import { getLetterByLegacyDisplayId } from "@/lib/data";

/**
 * Legacy link support: the old Firebase site shared recipient links as
 * /display.html?displayId=<code>. Redirect them to the new /l/<token> page.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  // Behind the reverse proxy the request URL reflects the internal bind
  // address (0.0.0.0:3000), so build redirects from the public app URL.
  const base = process.env.NEXT_PUBLIC_APP_URL || url.origin;
  const displayId = url.searchParams.get("displayId");
  if (displayId) {
    const letter = await getLetterByLegacyDisplayId(displayId);
    if (letter) {
      return NextResponse.redirect(new URL(`/l/${letter.share_token}`, base), 308);
    }
  }
  return NextResponse.redirect(new URL("/", base), 308);
}
