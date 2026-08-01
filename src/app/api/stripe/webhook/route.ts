import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { getStripe } from "@/lib/stripe";
import { setPremium } from "@/lib/data";

/** Stripe webhook: flip is_premium once the $1 checkout completes. */
export async function POST(req: Request) {
  const body = await req.text();
  const signature = req.headers.get("stripe-signature");
  if (!signature) return NextResponse.json({ error: "Missing signature" }, { status: 400 });

  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(body, signature, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    const clerkUserId = session.metadata?.clerk_user_id;
    if (clerkUserId && session.payment_status === "paid") {
      await setPremium(clerkUserId, typeof session.customer === "string" ? session.customer : null);
    }
  }

  return NextResponse.json({ received: true });
}
