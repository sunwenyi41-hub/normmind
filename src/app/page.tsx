import { redirect } from "next/navigation";
import { ChatShell } from "@/components/chat-shell";
import { isAdminUser } from "@/lib/admin-auth";
import { isPreviewMode } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ preview?: string }>;
}) {
  const { preview } = await searchParams;
  if (isPreviewMode || (process.env.NODE_ENV !== "production" && preview === "1")) {
    return <ChatShell initialConversations={[]} previewMode />;
  }
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=%2F");
  const { data } = await supabase
    .from("conversations")
    .select("id,title,updated_at")
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false })
    .limit(100);
  return <ChatShell initialConversations={data ?? []} isAdmin={isAdminUser(user)} />;
}
