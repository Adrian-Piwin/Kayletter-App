import { NextResponse } from "next/server";
import { getLetterByLegacyDisplayId } from "@/lib/data";

/**
 * Legacy link support: the old Firebase site shared recipient links as
 * /display.html?displayId=<code>. Redirect them to the new /l/<token> page.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const displayId = url.searchParams.get("displayId");
  if (displayId) {
    const letter = await getLetterByLegacyDisplayId(displayId);
    if (letter) {
      return NextResponse.redirect(new URL(`/l/${letter.share_token}`, url.origin), 308);
    }
  }
  return NextResponse.redirect(new URL("/", url.origin), 308);
}
