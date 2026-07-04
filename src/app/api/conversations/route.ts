import { NextResponse } from "next/server";
import { requireUser, unauthorized } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const user = await requireUser();
  if (!user || user.id === "preview-user") return unauthorized();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("conversations")
    .select("id,title,created_at,updated_at")
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false })
    .limit(100);
  if (error) return NextResponse.json({ error: "读取会话失败" }, { status: 500 });
  return NextResponse.json({ conversations: data });
}
