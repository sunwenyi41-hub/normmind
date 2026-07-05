import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUser, unauthorized } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

const schema = z.object({
  conversationId: z.string().uuid(),
  messageId: z.string().min(1).max(200),
  rating: z.enum(["helpful", "unhelpful"]),
  reason: z.string().trim().max(500).optional(),
});

export async function POST(request: NextRequest) {
  const user = await requireUser();
  if (!user || user.id === "preview-user") return unauthorized();
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "反馈格式不正确" }, { status: 400 });
  const supabase = await createClient();
  const { data: conversation } = await supabase
    .from("conversations")
    .select("id,messages_json")
    .eq("id", parsed.data.conversationId)
    .eq("user_id", user.id)
    .maybeSingle();
  const messages = Array.isArray(conversation?.messages_json) ? conversation.messages_json : [];
  const answerExists = messages.some((message) => {
    if (!message || typeof message !== "object") return false;
    const candidate = message as { id?: unknown; role?: unknown };
    return candidate.id === parsed.data.messageId && candidate.role === "assistant";
  });
  if (!conversation || !answerExists) return NextResponse.json({ error: "回答不存在" }, { status: 404 });

  const payload = {
    conversation_id: parsed.data.conversationId,
    answer_id: parsed.data.messageId,
    user_id: user.id,
    rating: parsed.data.rating,
    reason: parsed.data.reason ?? null,
  };
  const { data: existing } = await supabase
    .from("feedback")
    .select("id")
    .eq("conversation_id", parsed.data.conversationId)
    .eq("answer_id", parsed.data.messageId)
    .eq("user_id", user.id)
    .maybeSingle();
  const query = existing
    ? supabase.from("feedback").update(payload).eq("id", existing.id).eq("user_id", user.id)
    : supabase.from("feedback").insert(payload);
  const { error } = await query;
  if (error) return NextResponse.json({ error: "反馈保存失败" }, { status: 500 });
  return NextResponse.json({ ok: true });
}
