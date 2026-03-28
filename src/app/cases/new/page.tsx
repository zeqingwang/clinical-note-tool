import { redirect } from "next/navigation";
import { insertDraftCase } from "@/lib/cases-db";

export const dynamic = "force-dynamic";

export default async function NewCasePage() {
  const id = await insertDraftCase();
  redirect(`/cases/${id}`);
}
