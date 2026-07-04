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

export function getMessageText(message: Pick<NormMindUIMessage, "parts"> | undefined) {
  if (!message) return "";
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
  const part = [...message.parts].reverse().find((item) => item.type === "data-answerMeta");
  return part?.data;
}
