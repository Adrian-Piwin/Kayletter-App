import { NextResponse } from "next/server";
import { getAuthorContext } from "@/lib/author";
import { getStripe } from "@/lib/stripe";
import { UPGRADE_PRICE_CENTS } from "@/lib/plan";

/** Create a Stripe Checkout session for the one-time unlimited-notes upgrade. */
export async function POST() {
  const ctx = await getAuthorContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (ctx.profile.is_premium) {
    return NextResponse.json({ error: "Already upgraded" }, { status: 409 });
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL!;
  const session = await getStripe().checkout.sessions.create({
    mode: "payment",
    customer_email: ctx.profile.email || undefined,
    line_items: [
      {
        price_data: {
          currency: "usd",
          unit_amount: UPGRADE_PRICE_CENTS,
          product_data: {
            name: "Kayletter — unlimited notes",
            description: "One-time upgrade: write as many notes as your heart holds.",
          },
        },
        quantity: 1,
      },
    ],
    metadata: { clerk_user_id: ctx.profile.clerk_user_id },
    success_url: `${appUrl}/notes?upgraded=1`,
    cancel_url: `${appUrl}/notes`,
  });

  return NextResponse.json({ url: session.url });
}
