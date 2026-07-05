import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import {
  consumeStream,
  createUIMessageStream,
  createUIMessageStreamResponse,
  type InferUIMessageChunk,
  type UIMessage,
  validateUIMessages,
} from "ai";
import { toBaseMessages, toUIMessageStream } from "@ai-sdk/langchain";
import { Command } from "@langchain/langgraph";
import { z } from "zod";
import { requireUser, unauthorized } from "@/lib/auth";
import { createNormMindAgent } from "@/lib/agent";
import type {
  AnswerStatus,
  ChatMode,
  Citation,
  NormMindUIMessage,
} from "@/lib/chat";
import { getAnswerMeta, getMessageText } from "@/lib/chat";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 240;

const bodySchema = z.object({
  id: z.string().uuid(),
  messages: z.array(z.custom<NormMindUIMessage>()),
  mode: z.enum(["standard", "deep"]).default("standard"),
  scope: z.string().optional(),
  resume: z.record(z.string(), z.unknown()).optional(),
});

async function ensureConversation({
  conversationId,
  title,
  userId,
}: {
  conversationId: string;
  title: string;
  userId: string;
}) {
  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("conversations")
    .select("id")
    .eq("id", conversationId)
    .eq("user_id", userId)
    .maybeSingle();

  if (existing) return supabase;

  const { error } = await supabase.from("conversations").insert({
    id: conversationId,
    user_id: userId,
    title: title.slice(0, 36),
  });

  if (error) {
    console.error("conversation_insert_failed", {
      conversationId,
      userId,
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint,
    });
    throw new Error(`创建会话失败：${error.message}`);
  }
  return supabase;
}

async function persistConversationSnapshot({
  supabase,
  conversationId,
  userId,
  messages,
  mode,
}: {
  supabase: Awaited<ReturnType<typeof createClient>>;
  conversationId: string;
  userId: string;
  messages: NormMindUIMessage[];
  mode: ChatMode;
}) {
  const firstUserMessage = messages.find((message) => message.role === "user");
  const latestAssistant = [...messages].reverse().find((message) => message.role === "assistant");
  const assistantText = getMessageText(latestAssistant);
  const answerMeta = getAnswerMeta(latestAssistant);

  const { error: updateError } = await supabase
    .from("conversations")
    .update({
      title: (getMessageText(firstUserMessage) || "新会话").slice(0, 36),
      messages_json: messages,
      last_mode: mode,
      last_message_preview: assistantText.slice(0, 240),
      updated_at: new Date().toISOString(),
    })
    .eq("id", conversationId)
    .eq("user_id", userId);

  if (updateError) {
    console.error("conversation_snapshot_update_failed", {
      conversationId,
      userId,
      code: updateError.code,
      message: updateError.message,
      details: updateError.details,
      hint: updateError.hint,
    });
    throw new Error(`保存会话快照失败：${updateError.message}`);
  }

  if (!latestAssistant) return;

  const { error: insertError } = await supabase.from("messages").upsert(
    {
      id: latestAssistant.id,
      conversation_id: conversationId,
      user_id: userId,
      role: "assistant",
      content: assistantText || "未生成文本回答",
      mode,
      status: answerMeta?.status ?? "failed",
      citations_json: answerMeta?.citations ?? [],
      trace_id: answerMeta?.traceId ?? null,
      latency_ms: answerMeta?.latencyMs ?? null,
    },
    { onConflict: "id" },
  );

  if (insertError) {
    console.warn("assistant_audit_row_upsert_failed", insertError);
  }
}

export async function POST(request: NextRequest) {
  const user = await requireUser();
  if (!user) return unauthorized();

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "请求体格式不正确" }, { status: 400 });
  }

  const { id: conversationId, mode, scope, resume } = parsed.data;
  const title = getMessageText(parsed.data.messages.find((message) => message.role === "user")) || "新会话";

  const validatedMessages = await validateUIMessages({
    messages: parsed.data.messages as UIMessage[],
  }) as NormMindUIMessage[];

  const supabase = await ensureConversation({
    conversationId,
    title,
    userId: user.id,
  });

  const capture = {
    citations: [] as Citation[],
    status: "failed" as AnswerStatus,
    traceId: randomUUID(),
    latencyMs: 0,
    delivery: "coze_bot_v3" as const,
  };

  try {
    const agent = await createNormMindAgent({
      mode,
      scope,
      capture,
    });

    const baseMessages = await toBaseMessages(validatedMessages);

    const stream = createUIMessageStream<NormMindUIMessage>({
      originalMessages: validatedMessages,
      generateId: () => randomUUID(),
      execute: async ({ writer }) => {
        writer.write({
          type: "data-pipeline",
          data: {
            step: mode === "deep" ? "正在拆解复杂问题" : "正在理解规范问题",
            state: "loading",
            detail: scope ? `检索范围：${scope}` : "检索范围：全库",
          },
          transient: true,
        });

        const langchainStream = await agent.stream(
          resume
            ? new Command({ resume })
            : { messages: baseMessages },
          {
            streamMode: ["values", "messages", "custom"],
            configurable: { thread_id: conversationId },
            signal: request.signal,
          },
        );

        writer.merge(
          toUIMessageStream(langchainStream, {
            onError(error) {
              capture.status = "failed";
              capture.traceId = randomUUID();
              console.error("langchain_stream_failed", error);
            },
          }) as ReadableStream<InferUIMessageChunk<NormMindUIMessage>>,
        );
      },
      onEnd: async ({ messages }) => {
        await persistConversationSnapshot({
          supabase,
          conversationId,
          userId: user.id,
          messages,
          mode,
        });
      },
    });

    return createUIMessageStreamResponse({
      stream,
      consumeSseStream: consumeStream,
    });
  } catch (error) {
    console.error("chat_request_failed", {
      userId: user.id,
      conversationId,
      error: error instanceof Error ? error.message : error,
    });

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "智能检索服务暂时不可用",
      },
      { status: 502 },
    );
  }
}
