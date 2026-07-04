import { randomUUID } from "node:crypto";
import type { ChatMode, Citation, CozeAnswer } from "@/lib/chat";
import { resolveStandardPdf } from "@/lib/standard-documents";

type CozeRecord = Record<string, unknown>;

function asRecord(value: unknown): CozeRecord {
  return value && typeof value === "object" ? (value as CozeRecord) : {};
}

function parseMaybeJson(value: unknown): unknown {
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

function asArray(value: unknown) {
  return Array.isArray(value) ? value : [];
}

function findFirstString(value: unknown, keys: string[]) {
  const record = asRecord(value);
  for (const key of keys) {
    const candidate = record[key];
    if (typeof candidate === "string" && candidate.trim()) return candidate.trim();
  }
  return "";
}

function normalizeCitations(value: unknown): Citation[] {
  const parsed = parseMaybeJson(value);
  if (!Array.isArray(parsed)) return [];

  return parsed
    .map((item) => asRecord(item))
    .filter((item) => item.documentTitle || item.title || item.document_name)
    .map((item) => {
      const excerpt = String(item.excerpt ?? item.content ?? item.text ?? "未提供原文片段");
      const inferredClause =
        excerpt.match(/(?:^|\s)(\d+[.,，]\d+(?:[.,，]\d+)?)/)?.[1]?.replace(/[，,]/g, ".") ?? null;

      const citation: Citation = {
        ...(item.documentId || item.document_id
          ? { documentId: String(item.documentId ?? item.document_id) }
          : {}),
        documentTitle: String(item.documentTitle ?? item.title ?? item.document_name ?? "未知规范"),
        version: item.version ? String(item.version) : null,
        clause: item.clause ? String(item.clause) : item.article ? String(item.article) : inferredClause,
        ...(typeof item.pageNumber === "number" || typeof item.page_number === "number"
          ? { pageNumber: Number(item.pageNumber ?? item.page_number) }
          : {}),
        excerpt,
      };

      const sourceUrl = item.sourceUrl || item.url
        ? String(item.sourceUrl ?? item.url)
        : resolveStandardPdf(citation);
      const pageMatch = sourceUrl?.match(/#page=(\d+)/);

      return sourceUrl
        ? { ...citation, ...(pageMatch ? { pageNumber: Number(pageMatch[1]) } : {}), sourceUrl }
        : citation;
    });
}

function normalizeAnswer({
  answer,
  citations,
  mode,
  traceId,
  startedAt,
  delivery,
}: {
  answer: string;
  citations: Citation[];
  mode: ChatMode;
  traceId: string;
  startedAt: number;
  delivery: CozeAnswer["delivery"];
}): CozeAnswer {
  const trimmed = answer.trim();

  if (!trimmed) {
    return {
      answer: "当前知识库未检索到足以支持确定结论的规范依据。请补充项目所在地、建筑类型或具体使用场景后重试。",
      mode,
      status: "insufficient_evidence",
      citations: [],
      traceId,
      latencyMs: Date.now() - startedAt,
      delivery,
    };
  }

  if (citations.length === 0) {
    return {
      answer: `当前 Coze 未返回可核验的规范引用，以下内容仅供初步参考，请勿直接作为设计或审查结论：\n\n${trimmed}`,
      mode,
      status: "insufficient_evidence",
      citations: [],
      traceId,
      latencyMs: Date.now() - startedAt,
      delivery,
    };
  }

  return {
    answer: trimmed,
    mode,
    status: "completed",
    citations,
    traceId,
    latencyMs: Date.now() - startedAt,
    delivery,
  };
}

function extractAssistantContent(value: unknown) {
  const item = asRecord(parseMaybeJson(value));
  const content = parseMaybeJson(item.content ?? item.answer ?? item.output ?? item.text);
  if (typeof content === "string" && content.trim()) return content.trim();

  const nested = asRecord(content);
  const nestedAnswer = findFirstString(nested, ["answer", "output", "content", "text"]);
  if (nestedAnswer) return nestedAnswer;

  return "";
}

function extractMessagesFromResponse(raw: CozeRecord) {
  return [
    ...asArray(raw.messages),
    ...asArray(asRecord(raw.data).messages),
    ...asArray(asRecord(raw.data).message_list),
    ...asArray(raw.message_list),
  ];
}

function collectAnswerFromMessages(messages: unknown[]) {
  const assistantMessages = messages
    .map((item) => asRecord(parseMaybeJson(item)))
    .filter((item) => {
      const role = String(item.role ?? item.type ?? "");
      return /assistant|answer/i.test(role);
    });

  const answer =
    assistantMessages.map((item) => extractAssistantContent(item)).find(Boolean) ??
    "";
  const citations =
    assistantMessages
      .map((item) => normalizeCitations(item.citations ?? item.references ?? item.meta_data))
      .find((items) => items.length > 0) ?? [];

  return { answer, citations };
}

async function pollCozeChatResult({
  baseUrl,
  token,
  conversationId,
  chatId,
  signal,
}: {
  baseUrl: string;
  token: string;
  conversationId: string;
  chatId: string;
  signal: AbortSignal;
}) {
  const headers = { Authorization: `Bearer ${token}` };
  let latestStatus = "";

  for (let attempt = 0; attempt < 10; attempt += 1) {
    const retrieve = await fetch(
      `${baseUrl}/v3/chat/retrieve?conversation_id=${conversationId}&chat_id=${chatId}`,
      { headers, cache: "no-store", signal },
    );

    if (retrieve.ok) {
      const payload = asRecord(await retrieve.json());
      latestStatus = String(
        asRecord(payload.data).status ?? payload.status ?? latestStatus,
      ).toLowerCase();

      if (["completed", "failed", "canceled", "cancelled", "requires_action"].includes(latestStatus)) {
        break;
      }
    }

    await new Promise((resolve) => setTimeout(resolve, 1200));
  }

  const messagesResponse = await fetch(
    `${baseUrl}/v3/chat/message/list?conversation_id=${conversationId}&chat_id=${chatId}`,
    { headers, cache: "no-store", signal },
  );

  if (!messagesResponse.ok) {
    throw new Error(`Coze 消息读取失败（${messagesResponse.status}）`);
  }

  const payload = asRecord(await messagesResponse.json());
  return {
    status: latestStatus,
    messages: [
      ...asArray(asRecord(payload.data).messages),
      ...asArray(asRecord(payload.data).message_list),
      ...asArray(payload.messages),
      ...asArray(payload.message_list),
    ],
  };
}

async function runCozeBotSingleTurn(question: string, mode: ChatMode): Promise<CozeAnswer> {
  const startedAt = Date.now();
  const token = process.env.COZE_API_TOKEN;
  const botId = process.env.COZE_BOT_ID;

  if (!token || !botId) {
    throw new Error("Coze Bot Token 或 Bot ID 尚未配置");
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), mode === "deep" ? 120_000 : 60_000);
  const baseUrl = (process.env.COZE_API_BASE_URL ?? "https://api.coze.cn").replace(/\/$/, "");

  try {
    const response = await fetch(`${baseUrl}/v3/chat`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        bot_id: botId,
        user_id: `normmind-${randomUUID()}`,
        stream: false,
        auto_save_history: false,
        additional_messages: [
          {
            role: "user",
            content: question,
            content_type: "text",
          },
        ],
        custom_variables: {
          mode,
        },
      }),
      signal: controller.signal,
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error(`Coze Bot 请求失败（${response.status}）`);
    }

    const raw = asRecord(await response.json());
    const traceId = String(raw.trace_id ?? asRecord(raw.data).id ?? randomUUID());
    const immediate = collectAnswerFromMessages(extractMessagesFromResponse(raw));
    const directAnswer =
      immediate.answer ||
      findFirstString(asRecord(raw.data), ["answer", "output", "content", "text"]) ||
      findFirstString(raw, ["answer", "output", "content", "text"]);

    if (directAnswer) {
      return normalizeAnswer({
        answer: directAnswer,
        citations: immediate.citations,
        mode,
        traceId,
        startedAt,
        delivery: "coze_bot_v3",
      });
    }

    const chatData = asRecord(raw.data);
    const conversationId = String(chatData.conversation_id ?? raw.conversation_id ?? "");
    const chatId = String(chatData.id ?? raw.id ?? "");

    if (!conversationId || !chatId) {
      throw new Error("Coze Bot 未返回可读取的会话标识");
    }

    const polled = await pollCozeChatResult({
      baseUrl,
      token,
      conversationId,
      chatId,
      signal: controller.signal,
    });

    const { answer, citations } = collectAnswerFromMessages(polled.messages);

    return normalizeAnswer({
      answer,
      citations,
      mode,
      traceId,
      startedAt,
      delivery: "coze_bot_v3",
    });
  } finally {
    clearTimeout(timeout);
  }
}

async function runCozeWorkflowFallback(question: string, mode: ChatMode): Promise<CozeAnswer> {
  const startedAt = Date.now();
  const token = process.env.COZE_API_TOKEN;
  const workflowId =
    mode === "deep"
      ? process.env.COZE_DEEP_WORKFLOW_ID
      : process.env.COZE_STANDARD_WORKFLOW_ID;

  if (!token || !workflowId) {
    throw new Error("Coze 工作流兜底配置缺失");
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), mode === "deep" ? 180_000 : 120_000);

  try {
    const baseUrl = (process.env.COZE_API_BASE_URL ?? "https://api.coze.cn/v1").replace(/\/$/, "");
    const response = await fetch(`${baseUrl}/workflow/run`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        workflow_id: workflowId,
        parameters: { question, query: question },
      }),
      signal: controller.signal,
      cache: "no-store",
    });

    if (!response.ok) throw new Error(`Coze Workflow 请求失败（${response.status}）`);
    const raw = asRecord(await response.json());
    const parsedData = parseMaybeJson(raw.data);
    const data = asRecord(parsedData);
    const output = asRecord(parseMaybeJson(data.output ?? data.result ?? parsedData));
    const answer = String(output.answer ?? data.answer ?? raw.answer ?? output.content ?? data.output ?? "").trim();
    const citations = normalizeCitations(
      output.citations ?? data.citations ?? raw.citations ?? output.references,
    );
    const traceId = String(raw.trace_id ?? raw.execute_id ?? randomUUID());

    return normalizeAnswer({
      answer,
      citations,
      mode,
      traceId,
      startedAt,
      delivery: "coze_workflow_fallback",
    });
  } finally {
    clearTimeout(timeout);
  }
}

export async function runCozeKnowledgeAgent(question: string, mode: ChatMode): Promise<CozeAnswer> {
  try {
    return await runCozeBotSingleTurn(question, mode);
  } catch (error) {
    const canFallback = Boolean(
      process.env.COZE_STANDARD_WORKFLOW_ID || process.env.COZE_DEEP_WORKFLOW_ID,
    );
    if (!canFallback) throw error;

    console.warn("coze_bot_single_turn_failed_falling_back_to_workflow", {
      mode,
      error: error instanceof Error ? error.message : error,
    });

    return runCozeWorkflowFallback(question, mode);
  }
}
