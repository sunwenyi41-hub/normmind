import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUser, unauthorized } from "@/lib/auth";
import { normalizeUIMessages, type Citation, type NormMindUIMessage } from "@/lib/chat";
import { createClient } from "@/lib/supabase/server";

type Context = { params: Promise<{ id: string }> };

function fromLegacyRows(
  rows: Array<{
    id: string;
    role: "user" | "assistant";
    content: string;
    mode: "standard" | "deep";
    status: "completed" | "insufficient_evidence" | "failed";
    citations_json: unknown[];
    trace_id: string | null;
    latency_ms: number | null;
  }>,
): NormMindUIMessage[] {
  return rows.map((row) => ({
    id: row.id,
    role: row.role,
    metadata: row.role === "assistant"
      ? {
          mode: row.mode,
          status: row.status,
          citations: row.citations_json as Citation[],
          traceId: row.trace_id ?? undefined,
          latencyMs: row.latency_ms ?? undefined,
        }
      : {
          mode: row.mode,
        },
    parts: [
      {
        type: "text",
        text: row.content,
      },
    ],
  }));
}

export async function GET(_request: NextRequest, context: Context) {
  const user = await requireUser();
  if (!user || user.id === "preview-user") return unauthorized();
  const { id } = await context.params;
  if (!z.string().uuid().safeParse(id).success) return NextResponse.json({ error: "无效会话" }, { status: 400 });
  const supabase = await createClient();
  const { data: conversation } = await supabase
    .from("conversations")
    .select("id,title,messages_json")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!conversation) return NextResponse.json({ error: "会话不存在" }, { status: 404 });

  if (Array.isArray(conversation.messages_json) && conversation.messages_json.length > 0) {
    return NextResponse.json({
      conversation: { id: conversation.id, title: conversation.title },
      messages: normalizeUIMessages(conversation.messages_json),
    });
  }

  const { data: messages, error } = await supabase
    .from("messages")
    .select("id,role,content,mode,status,citations_json,trace_id,latency_ms,created_at")
    .eq("conversation_id", id)
    .eq("user_id", user.id)
    .order("created_at", { ascending: true });
  if (error) return NextResponse.json({ error: "读取消息失败" }, { status: 500 });

  return NextResponse.json({
    conversation: { id: conversation.id, title: conversation.title },
    messages: normalizeUIMessages(fromLegacyRows(messages ?? [])),
  });
}

export async function DELETE(_request: NextRequest, context: Context) {
  const user = await requireUser();
  if (!user || user.id === "preview-user") return unauthorized();
  const { id } = await context.params;
  const supabase = await createClient();
  const { error } = await supabase.from("conversations").delete().eq("id", id).eq("user_id", user.id);
  if (error) return NextResponse.json({ error: "删除会话失败" }, { status: 500 });
  return new NextResponse(null, { status: 204 });
}
