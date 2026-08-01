import { redirect } from "next/navigation";
import { getAuthorContext } from "@/lib/author";
import { listNotes } from "@/lib/data";
import Dashboard from "@/components/dashboard/Dashboard";

export const dynamic = "force-dynamic";

export default async function NotesPage() {
  const ctx = await getAuthorContext();
  if (!ctx) redirect("/");

  const notes = await listNotes(ctx.letter.id);
  return <Dashboard letter={ctx.letter} initialNotes={notes} isPremium={ctx.profile.is_premium} />;
}
