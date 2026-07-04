import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUser, unauthorized } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

const schema = z.object({ messageId: z.string().uuid(), rating: z.enum(["helpful", "unhelpful"]), reason: z.string().trim().max(500).optional() });

export async function POST(request: NextRequest) {
  const user = await requireUser();
  if (!user || user.id === "preview-user") return unauthorized();
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "反馈格式不正确" }, { status: 400 });
  const supabase = await createClient();
  const { data: message } = await supabase.from("messages").select("id").eq("id", parsed.data.messageId).eq("user_id", user.id).eq("role", "assistant").maybeSingle();
  if (!message) return NextResponse.json({ error: "回答不存在" }, { status: 404 });
  const { error } = await supabase.from("feedback").upsert({ message_id: parsed.data.messageId, user_id: user.id, rating: parsed.data.rating, reason: parsed.data.reason ?? null }, { onConflict: "message_id,user_id" });
  if (error) return NextResponse.json({ error: "反馈保存失败" }, { status: 500 });
  return NextResponse.json({ ok: true });
}
