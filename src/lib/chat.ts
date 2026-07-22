import type { UIMessage } from "ai";

export type ChatMode = "standard" | "deep";
export type AnswerStatus = "completed" | "insufficient_evidence" | "failed";

export type Citation = {
  documentId?: string;
  documentTitle: string;
  version: string | null;
  clause: string | null;
  pageNumber?: number;
  excerpt: string;
  sourceUrl?: string;
};

export type ChatMessageMetadata = {
  mode?: ChatMode;
  status?: AnswerStatus;
  citations?: Citation[];
  traceId?: string;
  latencyMs?: number;
  scope?: string;
  delivery?: "coze_bot_v3" | "coze_workflow_fallback";
};

export type ChatDataParts = {
  pipeline: {
    step: string;
    state: "loading" | "success" | "error";
    detail?: string;
  };
  answerMeta: {
    mode: ChatMode;
    status: AnswerStatus;
    citations: Citation[];
    traceId: string;
    latencyMs: number;
    delivery: "coze_bot_v3" | "coze_workflow_fallback";
  };
};

export type NormMindUIMessage = UIMessage<ChatMessageMetadata, ChatDataParts>;

export type ConversationSummary = {
  id: string;
  title: string;
  updated_at: string;
};

export type CozeAnswer = {
  answer: string;
  mode: ChatMode;
  status: AnswerStatus;
  citations: Citation[];
  traceId: string;
  latencyMs: number;
  delivery: "coze_bot_v3" | "coze_workflow_fallback";
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function normalizeConversationSummary(value: unknown): ConversationSummary | null {
  if (!isRecord(value) || typeof value.id !== "string") return null;
  const updatedAt = typeof value.updated_at === "string" && !Number.isNaN(Date.parse(value.updated_at))
    ? value.updated_at
    : new Date().toISOString();

  return {
    id: value.id,
    title: typeof value.title === "string" && value.title.trim() ? value.title : "未命名会话",
    updated_at: updatedAt,
  };
}

export function normalizeConversationSummaries(values: unknown): ConversationSummary[] {
  if (!Array.isArray(values)) return [];
  return values
    .map((value) => normalizeConversationSummary(value))
    .filter((value): value is ConversationSummary => Boolean(value));
}

export function normalizeUIMessage(value: unknown): NormMindUIMessage | null {
  if (!isRecord(value)) return null;
  const role = value.role === "user" || value.role === "assistant" ? value.role : null;
  if (!role) return null;

  const rawParts = Array.isArray(value.parts) ? value.parts : [];
  const parts = rawParts
    .filter((part): part is Record<string, unknown> => isRecord(part) && typeof part.type === "string")
    .flatMap((part) => {
      if (part.type === "text") {
        return [{
          type: "text" as const,
          text: typeof part.text === "string" ? part.text : "",
        }];
      }

      if (part.type === "data-pipeline" || part.type === "data-answerMeta") {
        return [part as NormMindUIMessage["parts"][number]];
      }

      return [];
    });

  if (parts.length === 0) {
    const fallbackText = typeof value.content === "string" ? value.content : "";
    parts.push({ type: "text", text: fallbackText });
  }

  return {
    id: typeof value.id === "string" ? value.id : crypto.randomUUID(),
    role,
    metadata: isRecord(value.metadata) ? value.metadata as NormMindUIMessage["metadata"] : undefined,
    parts,
  };
}

export function normalizeUIMessages(values: unknown): NormMindUIMessage[] {
  if (!Array.isArray(values)) return [];
  return values
    .map((value) => normalizeUIMessage(value))
    .filter((value): value is NormMindUIMessage => Boolean(value));
}

export function getMessageText(message: Pick<NormMindUIMessage, "parts"> | undefined) {
  if (!message) return "";
  if (!Array.isArray(message.parts)) return "";
  return message.parts
    .filter((part) => part.type === "text")
    .map((part) => part.text)
    .join("")
    .trim();
}

export function getMessageCitations(message: NormMindUIMessage | undefined) {
  const meta = getAnswerMeta(message);
  return meta?.citations ?? message?.metadata?.citations ?? [];
}

export function getLatestAssistantMessage(messages: NormMindUIMessage[]) {
  return [...messages].reverse().find((message) => message.role === "assistant");
}

export function getAnswerMeta(message: NormMindUIMessage | undefined) {
  if (!message) return undefined;
  if (!Array.isArray(message.parts)) return undefined;
  const part = [...message.parts].reverse().find((item) => item.type === "data-answerMeta");
  return part?.data;
}
