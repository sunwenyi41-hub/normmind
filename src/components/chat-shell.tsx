"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import {
  AlertCircle,
  ArrowRight,
  BarChart3,
  BookOpen,
  Bookmark,
  Bot,
  Boxes,
  Check,
  CheckCircle2,
  ChevronRight,
  Clipboard,
  ClipboardList,
  Clock3,
  Download,
  ExternalLink,
  FlaskConical,
  FileCheck2,
  FileSearch,
  FolderOpen,
  History,
  Library,
  Loader2,
  Menu,
  MessageSquareWarning,
  MessageSquarePlus,
  PanelRight,
  RefreshCcw,
  Search,
  ShieldCheck,
  Send,
  Settings,
  Sparkles,
  SquareArrowOutUpRight,
  ThumbsDown,
  ThumbsUp,
  Upload,
  User,
  X,
} from "lucide-react";
import { z } from "zod";
import { createClient } from "@/lib/supabase/client";
import {
  type ChatMode,
  type Citation,
  type ConversationSummary,
  type NormMindUIMessage,
  getAnswerMeta,
  getLatestAssistantMessage,
  getMessageCitations,
  getMessageText,
} from "@/lib/chat";
import { isDevelopment } from "@/lib/env";
import {
  findRelatedStandardDocuments,
  getStandardLibraryDocuments,
  type RelatedStandardDocument,
  type StandardLibraryDocument,
} from "@/lib/standard-documents";
import { agentConfigs, evalSuites, feedbackItems, qaSampleGroups, qualityMetrics } from "@/lib/admin-demo";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

const prompts = [
  "住宅建筑的疏散楼梯最小净宽是多少？",
  "屋顶绿化的覆土厚度有哪些要求？",
  "无障碍坡道坡度与平台尺寸如何规定？",
  "比较两个规范对消防车道宽度的要求",
];

const messageMetadataSchema = z.object({
  mode: z.enum(["standard", "deep"]).optional(),
  status: z.enum(["completed", "insufficient_evidence", "failed"]).optional(),
  citations: z.array(
    z.object({
      documentId: z.string().optional(),
      documentTitle: z.string(),
      version: z.string().nullable(),
      clause: z.string().nullable(),
      pageNumber: z.number().optional(),
      excerpt: z.string(),
      sourceUrl: z.string().optional(),
    }),
  ).optional(),
  traceId: z.string().optional(),
  latencyMs: z.number().optional(),
  scope: z.string().optional(),
  delivery: z.enum(["coze_bot_v3", "coze_workflow_fallback"]).optional(),
});

type WorkspaceView = "chat" | "library";
type InspectorTab = "sources" | "process";
type SourceViewMode = "excerpt" | "pdf";

function getPdfPageFromCitation(citation?: Citation) {
  if (!citation) return null;
  if (citation.pageNumber) return citation.pageNumber;
  const match = citation.sourceUrl?.match(/#page=(\d+)/);
  return match ? Number(match[1]) : null;
}

function canPreviewPdf(citation?: Citation) {
  if (!citation?.sourceUrl) return false;
  return /\.pdf(?:$|[?#])/i.test(citation.sourceUrl);
}

function normalizeTransportErrorMessage(message?: string) {
  if (!message) return "服务暂时不可用";

  try {
    const parsed = JSON.parse(message) as { error?: string };
    if (parsed?.error) return parsed.error;
  } catch {
    // ignore malformed JSON-like strings
  }

  return message;
}

function getCitationLocateKeywords(citation?: Citation) {
  if (!citation) return [];

  const candidates = [
    citation.clause ?? "",
    ...citation.excerpt
      .split(/[\n，。；：、（）()]/)
      .map((item) => item.trim())
      .filter((item) => item.length >= 4 && item.length <= 18),
  ];

  return [...new Set(candidates)]
    .filter(Boolean)
    .slice(0, 4);
}

function buildCitationLocateHint(citation?: Citation) {
  if (!citation) return "";

  const parts = [
    `规范：${citation.documentTitle}`,
    citation.version ? `版本：${citation.version}` : "",
    citation.clause ? `条款：${citation.clause}` : "",
    getPdfPageFromCitation(citation) ? `页码：第 ${getPdfPageFromCitation(citation)} 页` : "",
  ].filter(Boolean);

  const keywords = getCitationLocateKeywords(citation);
  if (keywords.length > 0) {
    parts.push(`检索词：${keywords.join(" / ")}`);
  }

  return parts.join("\n");
}

export function ChatShell({
  initialConversations,
  previewMode = false,
}: {
  initialConversations: ConversationSummary[];
  previewMode?: boolean;
}) {
  const [conversations, setConversations] = useState(initialConversations);
  const [messageCache, setMessageCache] = useState<Record<string, NormMindUIMessage[]>>({});
  const [activeId, setActiveId] = useState<string | null>(null);
  const [draftId, setDraftId] = useState(() => crypto.randomUUID());
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loadingConversation, setLoadingConversation] = useState(false);
  const [seeding, setSeeding] = useState(false);

  const currentConversationId = activeId ?? draftId;
  const currentMessages = activeId ? (messageCache[activeId] ?? []) : [];

  function upsertConversationSummary(conversationId: string, title: string) {
    setConversations((current) => {
      const existing = current.find((item) => item.id === conversationId);
      const summary = {
        id: conversationId,
        title: existing?.title ?? title.slice(0, 24),
        updated_at: new Date().toISOString(),
      };
      return [summary, ...current.filter((item) => item.id !== conversationId)].slice(0, 100);
    });
  }

  async function loadConversation(id: string) {
    setLoadingConversation(true);
    setSidebarOpen(false);

    try {
      if (messageCache[id]) {
        setActiveId(id);
        return;
      }

      const response = await fetch(`/api/conversations/${id}`);
      if (!response.ok) return;
      const data = await response.json();
      setMessageCache((current) => ({ ...current, [id]: data.messages ?? [] }));
      setActiveId(id);
    } finally {
      setLoadingConversation(false);
    }
  }

  async function deleteConversation(id: string) {
    if (!previewMode) {
      await fetch(`/api/conversations/${id}`, { method: "DELETE" });
    }

    setConversations((items) => items.filter((item) => item.id !== id));
    setMessageCache((current) => {
      const next = { ...current };
      delete next[id];
      return next;
    });

    if (activeId === id) {
      setActiveId(null);
      setDraftId(crypto.randomUUID());
    }
  }

  async function seedDevelopmentData() {
    if (!isDevelopment || previewMode || seeding) return;
    setSeeding(true);
    try {
      const response = await fetch("/api/dev/seed", { method: "POST" });
      const data = await response.json().catch(() => null);
      if (!response.ok) return;
      setConversations(data?.conversations ?? []);
      if (data?.seededConversationId) {
        await loadConversation(String(data.seededConversationId));
      }
    } finally {
      setSeeding(false);
    }
  }

  function newConversation() {
    setActiveId(null);
    setDraftId(crypto.randomUUID());
    setSidebarOpen(false);
  }

  return (
    <div className="flex min-h-[calc(100vh-5rem)] overflow-hidden rounded-[28px] border border-slate-200/80 bg-white shadow-[0_40px_120px_-52px_rgba(15,23,42,0.35)]">
      <aside className={cn("fixed inset-y-0 start-0 z-50 flex w-72 flex-col border-e bg-[#f8fafb] transition-transform lg:static lg:z-auto lg:translate-x-0", sidebarOpen ? "translate-x-0" : "-translate-x-full")}>
        <div className="flex h-16 items-center justify-between border-b bg-white px-4">
          <div>
            <p className="text-sm font-semibold text-slate-900">规智工作台</p>
            <p className="text-xs text-muted-foreground">NormMind Workspace</p>
          </div>
          <Button aria-label="关闭会话侧栏" className="lg:hidden" size="icon" variant="ghost" onClick={() => setSidebarOpen(false)}>
            <X className="size-4" />
          </Button>
        </div>

        <div className="p-4">
          <Button className="w-full justify-start gap-2 rounded-xl" onClick={newConversation}>
            <MessageSquarePlus className="size-4" />
            新建对话
          </Button>
          {isDevelopment && !previewMode ? (
            <Button className="mt-2 w-full justify-start gap-2 rounded-xl" disabled={seeding} variant="outline" onClick={() => void seedDevelopmentData()}>
              {seeding ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
              生成测试数据
            </Button>
          ) : null}
        </div>

        <div className="px-4 text-xs font-medium text-muted-foreground">最近会话</div>
        <div className="flex-1 overflow-y-auto px-3 py-3">
          <div className="space-y-2">
            {conversations.length === 0 ? (
              <div className="rounded-2xl border border-dashed bg-white px-4 py-6 text-center text-xs text-muted-foreground">
                还没有历史会话，先从一个规范问题开始吧。
              </div>
            ) : null}

            {conversations.map((conversation) => (
              <div key={conversation.id} className={cn("group rounded-2xl border bg-white p-3 transition", activeId === conversation.id && "border-primary/35 bg-blue-50/40")}>
                <button className="w-full text-left" onClick={() => void loadConversation(conversation.id)}>
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 rounded-lg bg-secondary p-2 text-muted-foreground">
                      <History className="size-3.5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="line-clamp-2 text-sm font-medium leading-5 text-slate-900">{conversation.title}</p>
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        {new Date(conversation.updated_at).toLocaleString("zh-CN", {
                          month: "2-digit",
                          day: "2-digit",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                    </div>
                  </div>
                </button>
                <div className="mt-3 flex justify-end">
                  <button className="text-[11px] text-muted-foreground transition hover:text-rose-600" onClick={() => void deleteConversation(conversation.id)}>
                    删除
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {loadingConversation ? (
          <div className="grid flex-1 place-items-center">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              正在加载历史会话…
            </div>
          </div>
        ) : (
          <Workspace
            key={currentConversationId}
            conversationId={currentConversationId}
            initialMessages={currentMessages}
            previewMode={previewMode}
            onOpenSidebar={() => setSidebarOpen(true)}
            onConversationPersist={(payload) => {
              setMessageCache((current) => ({ ...current, [payload.id]: payload.messages }));
              upsertConversationSummary(payload.id, payload.title);
              if (!activeId) setActiveId(payload.id);
            }}
          />
        )}
      </div>
    </div>
  );
}

function Workspace({
  conversationId,
  initialMessages,
  previewMode,
  onOpenSidebar,
  onConversationPersist,
}: {
  conversationId: string;
  initialMessages: NormMindUIMessage[];
  previewMode: boolean;
  onOpenSidebar: () => void;
  onConversationPersist: (payload: {
    id: string;
    title: string;
    messages: NormMindUIMessage[];
  }) => void;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [mode, setMode] = useState<ChatMode>("standard");
  const [scope, setScope] = useState("all");
  const [input, setInput] = useState("");
  const [progress, setProgress] = useState("");
  const [view, setView] = useState<WorkspaceView>("chat");
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const [inspectorTab, setInspectorTab] = useState<InspectorTab>("sources");
  const [selectedCitation, setSelectedCitation] = useState(0);
  const [bookmarked, setBookmarked] = useState<string[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [uploadStep, setUploadStep] = useState(0);
  const bottomRef = useRef<HTMLDivElement>(null);

  const transport = useMemo(
    () =>
      new DefaultChatTransport<NormMindUIMessage>({
        api: "/api/chat",
        prepareSendMessagesRequest: ({ id, messages }) => ({
          body: {
            id,
            messages,
            mode,
            scope,
          },
        }),
      }),
    [mode, scope],
  );

  const {
    messages,
    sendMessage,
    regenerate,
    setMessages,
    status,
  } = useChat<NormMindUIMessage>({
    id: conversationId,
    generateId: () => crypto.randomUUID(),
    transport,
    messages: initialMessages,
    messageMetadataSchema,
    onError: (error) => {
      const errorMessage = normalizeTransportErrorMessage(error.message);
      const failureMessage: NormMindUIMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        metadata: {
          mode,
          status: "failed",
        },
        parts: [
          {
            type: "text",
            text: `${errorMessage || "服务暂时不可用"}。你的问题已保留，请稍后重试。`,
          },
        ],
      };

      setMessages((current) => {
        const next = [...current, failureMessage];
        onConversationPersist({
          id: conversationId,
          title: getMessageText(next.find((message) => message.role === "user")) || "新会话",
          messages: next,
        });
        return next;
      });
    },
    onFinish: ({ messages: finishedMessages }) => {
      onConversationPersist({
        id: conversationId,
        title: getMessageText(finishedMessages.find((message) => message.role === "user")) || "新会话",
        messages: finishedMessages,
      });
      setInspectorTab("sources");
    },
  });

  const loading = status === "submitted" || status === "streaming";
  const latestAssistant = useMemo(() => getLatestAssistantMessage(messages), [messages]);
  const citations = useMemo(() => getMessageCitations(latestAssistant), [latestAssistant]);
  const safeSelectedCitation = citations.length === 0 ? 0 : Math.min(selectedCitation, citations.length - 1);
  const relatedDocuments = useMemo(
    () =>
      findRelatedStandardDocuments(
        `${getMessageText(latestAssistant)} ${citations.map((citation) => `${citation.documentTitle} ${citation.version ?? ""}`).join(" ")}`,
      ),
    [citations, latestAssistant],
  );

  useEffect(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), [messages, progress]);

  useEffect(() => {
    if (!loading) return;

    const stages = mode === "deep"
      ? ["正在理解问题", "正在拆解检索任务", "正在调用 Coze Agent", "正在核对版本与条款", "正在整合答案"]
      : ["正在理解问题", "正在调用 Coze Agent", "正在核对规范引用", "正在生成回答"];

    let index = 0;
    const timer = window.setInterval(() => {
      index = Math.min(index + 1, stages.length - 1);
      setProgress(stages[index]);
    }, 1800);

    return () => window.clearInterval(timer);
  }, [loading, mode]);

  const visibleProgress = loading
    ? progress || (mode === "deep" ? "正在理解问题" : "正在理解问题")
    : "";

  async function submitMessage(value = input) {
    const text = value.trim();
    if (!text || loading) return;

    setInput("");
    setView("chat");
    setInspectorTab("process");
    setInspectorOpen(true);

    if (previewMode) {
      const previewLibraryDocs = getStandardLibraryDocuments();
      const matchedDocument =
        previewLibraryDocs.find((document) =>
          `${document.title} ${document.code} ${document.tags.join(" ")} ${document.summary}`
            .toLowerCase()
            .includes(text.toLowerCase()),
        ) ?? previewLibraryDocs[0];

      const previewCitations: Citation[] = matchedDocument
        ? [
          {
            documentTitle: matchedDocument.title,
            version: matchedDocument.version,
            clause: "演示条款",
            excerpt: `这是工作台预览模式下的演示引用。当前问题“${text}”在正式模式中会调用真实 Coze Agent，并返回可核验的规范片段、版本与条款信息。`,
            sourceUrl: matchedDocument.sourceUrl,
          },
        ]
        : [];

      const traceId = `preview-${crypto.randomUUID()}`;

      const userMessage: NormMindUIMessage = {
        id: crypto.randomUUID(),
        role: "user",
        metadata: {
          mode,
          scope,
        },
        parts: [{ type: "text", text }],
      };

      const assistantMessage: NormMindUIMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        metadata: {
          mode,
          status: "completed",
          citations: previewCitations,
          traceId,
          latencyMs: 1200,
          scope,
          delivery: "coze_workflow_fallback",
        },
        parts: [
          {
            type: "text",
            text:
              `这是预览模式下的演示回答。\n\n` +
              `你的问题是：${text}\n\n` +
              `当前页面不会调用真实登录态、Supabase 持久化或 Coze 知识检索，而是用来展示完整的工作台交互效果。若要查看真实问答结果，请使用邮箱登录后测试。`,
          },
          {
            type: "data-answerMeta",
            data: {
              mode,
              status: "completed",
              citations: previewCitations,
              traceId,
              latencyMs: 1200,
              delivery: "coze_workflow_fallback",
            },
          },
        ],
      };

      setMessages((current) => {
        const next = [...current, userMessage, assistantMessage];
        onConversationPersist({
          id: conversationId,
          title: getMessageText(next.find((message) => message.role === "user")) || "新会话",
          messages: next,
        });
        return next;
      });

      setInspectorTab("sources");
      return;
    }

    await sendMessage({
      text,
      metadata: {
        mode,
        scope,
      },
    });
  }

  async function signOut() {
    if (previewMode) return;
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <>
      <header className="flex h-16 shrink-0 items-center gap-3 border-b bg-white px-4 lg:px-6">
        <Button aria-label="打开会话侧栏" className="lg:hidden" size="icon" variant="ghost" onClick={onOpenSidebar}>
          <Menu className="size-4" />
        </Button>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-blue-50 px-2.5 py-1 text-[11px] font-semibold text-primary">NormMind</span>
            <h1 className="truncate text-sm font-semibold text-slate-900">规智 · 规范智能问答工作台</h1>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">面向建筑、规划、景观设计的规范检索与引用追溯</p>
        </div>
        <Button className="hidden lg:inline-flex" size="sm" variant="outline" onClick={() => setInspectorOpen((open) => !open)}>
          <PanelRight className="me-2 size-4" />
          右侧面板
        </Button>
      </header>

      <div className="flex min-h-0 flex-1">
        <main className="flex min-w-0 flex-1 flex-col bg-[#fcfdff]">
          <div className="flex items-center gap-2 border-b bg-white/80 px-4 py-3 backdrop-blur lg:px-6">
            <button className={cn("rounded-full px-3 py-1.5 text-xs font-medium", view === "chat" ? "bg-primary text-white" : "bg-secondary text-muted-foreground")} onClick={() => setView("chat")}>
              问答工作台
            </button>
            <button className={cn("rounded-full px-3 py-1.5 text-xs font-medium", view === "library" ? "bg-primary text-white" : "bg-secondary text-muted-foreground")} onClick={() => setView("library")}>
              规范资料库
            </button>
            <div className="ms-auto flex items-center gap-2">
              <Link
                className={cn("hidden rounded-full px-3 py-1.5 text-xs font-medium md:inline-flex", pathname === "/library" ? "bg-primary text-white" : "bg-secondary text-muted-foreground")}
                href={previewMode ? "/library?preview=1" : "/library"}
              >
                资料库独立页
              </Link>
              <Link
                className={cn("hidden rounded-full px-3 py-1.5 text-xs font-medium md:inline-flex", pathname === "/settings" ? "bg-primary text-white" : "bg-secondary text-muted-foreground")}
                href={previewMode ? "/settings?preview=1" : "/settings"}
              >
                账户设置
              </Link>
              <Link
                className={cn("hidden rounded-full px-3 py-1.5 text-xs font-medium md:inline-flex", pathname === "/admin" ? "bg-primary text-white" : "bg-secondary text-muted-foreground")}
                href={previewMode ? "/admin?preview=1" : "/admin"}
              >
                管理后台
              </Link>
              <Button size="sm" variant="ghost" onClick={signOut}>
                <User className="me-2 size-4" />
                {previewMode ? "体验模式" : "退出"}
              </Button>
            </div>
          </div>

          {view === "chat" ? (
            <>
              <div className="border-b bg-white px-4 py-4 lg:px-6">
                <div className="flex flex-wrap items-center gap-3">
                  <div className="rounded-2xl border bg-slate-50 p-1">
                    <button className={cn("rounded-xl px-3 py-2 text-xs font-medium", mode === "standard" && "bg-white text-primary shadow-sm")} onClick={() => setMode("standard")}>
                      <Search className="me-1 inline size-3.5" />
                      快速问答
                    </button>
                    <button className={cn("rounded-xl px-3 py-2 text-xs font-medium", mode === "deep" && "bg-white text-violet-700 shadow-sm")} onClick={() => setMode("deep")}>
                      <Sparkles className="me-1 inline size-3.5" />
                      深度检索
                    </button>
                  </div>

                  <div className="flex items-center gap-2 rounded-2xl border bg-white px-3 py-2 text-xs">
                    <Library className="size-3.5 text-muted-foreground" />
                    <span className="text-muted-foreground">检索范围</span>
                    <select className="bg-transparent text-slate-900 outline-none" value={scope} onChange={(event) => setScope(event.target.value)}>
                      <option value="all">全库</option>
                      <option value="residential">住宅规范</option>
                      <option value="landscape">景观规范</option>
                      <option value="enterprise">企业库（预留）</option>
                    </select>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  {prompts.map((prompt) => (
                    <button key={prompt} className="rounded-full border bg-white px-3 py-1.5 text-xs text-slate-700 transition hover:border-primary/30 hover:text-primary" onClick={() => void submitMessage(prompt)}>
                      {prompt}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex min-h-0 flex-1">
                <section className="flex min-w-0 flex-1 flex-col">
                  <div className="flex-1 overflow-y-auto px-4 py-6 lg:px-6">
                    {messages.length === 0 ? (
                      <div className="grid h-full place-items-center">
                        <div className="max-w-xl text-center">
                          <div className="mx-auto grid size-16 place-items-center rounded-3xl bg-blue-50 text-primary">
                            <Bot className="size-7" />
                          </div>
                          <h2 className="mt-5 text-xl font-semibold text-slate-900">从一个规范问题开始</h2>
                          <p className="mt-3 text-sm leading-7 text-muted-foreground">
                            你可以直接提问条文要求、版本适用、跨规范比较，右侧会同步展示引用原文与处理链路。
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-5">
                        {messages.map((message) => (
                          <MessageCard
                            key={message.id}
                            message={message}
                            previewMode={previewMode}
                            bookmarked={bookmarked.includes(message.id)}
                            copied={copiedId === message.id}
                            onBookmark={() => setBookmarked((current) => current.includes(message.id) ? current.filter((item) => item !== message.id) : [...current, message.id])}
                            onCopy={async () => {
                              await navigator.clipboard.writeText(getMessageText(message));
                              setCopiedId(message.id);
                              window.setTimeout(() => setCopiedId((current) => (current === message.id ? null : current)), 1400);
                            }}
                            onCitation={() => {
                              setInspectorTab("sources");
                              setInspectorOpen(true);
                            }}
                            onRetry={() => void regenerate({ body: { mode, scope } })}
                          />
                        ))}

                        {loading && (
                          <div className="flex gap-3">
                            <div className="grid size-8 place-items-center rounded-lg bg-primary text-white">
                              <Loader2 className="size-4 animate-spin" />
                            </div>
                            <div className="rounded-2xl rounded-ss-sm border bg-white px-4 py-3 text-sm text-muted-foreground shadow-sm">
                              {visibleProgress || "正在处理中…"}
                            </div>
                          </div>
                        )}
                        <div ref={bottomRef} />
                      </div>
                    )}
                  </div>

                  <div className="border-t bg-white px-4 py-4 lg:px-6">
                    <Composer
                      input={input}
                      loading={loading}
                      mode={mode}
                      setInput={setInput}
                      setMode={setMode}
                      onSend={() => void submitMessage()}
                    />
                  </div>
                </section>

                <Inspector
                  citations={citations}
                  relatedDocuments={relatedDocuments}
                  latestAssistant={latestAssistant}
                  loading={loading}
                  progress={visibleProgress}
                  selectedCitation={safeSelectedCitation}
                  setSelectedCitation={setSelectedCitation}
                  tab={inspectorTab}
                  setTab={setInspectorTab}
                  open={inspectorOpen}
                  onClose={() => setInspectorOpen(false)}
                />
              </div>
            </>
          ) : (
            <LibraryView uploadStep={uploadStep} setUploadStep={setUploadStep} />
          )}
        </main>
      </div>
    </>
  );
}

function MessageCard({
  message,
  previewMode,
  bookmarked,
  copied,
  onBookmark,
  onCopy,
  onCitation,
  onRetry,
}: {
  message: NormMindUIMessage;
  previewMode: boolean;
  bookmarked: boolean;
  copied: boolean;
  onBookmark: () => void;
  onCopy: () => void;
  onCitation: () => void;
  onRetry: () => void;
}) {
  if (message.role === "user") {
    return (
      <article className="flex justify-end">
        <div className="max-w-3xl rounded-2xl rounded-se-sm bg-slate-900 px-5 py-4 text-[15px] leading-7 text-white shadow-sm">
          {getMessageText(message)}
        </div>
      </article>
    );
  }

  const answerMeta = getAnswerMeta(message);
  const mode = answerMeta?.mode ?? message.metadata?.mode ?? "standard";
  const citations = answerMeta?.citations ?? [];
  const status = answerMeta?.status;
  const latencyMs = answerMeta?.latencyMs;

  return (
    <article className="flex gap-3">
      <div className="grid size-8 shrink-0 place-items-center rounded-lg bg-primary text-white">
        <Bot className="size-4" />
      </div>

      <div className="min-w-0 flex-1">
        <div className="mb-2 flex items-center gap-2">
          <span className="text-sm font-semibold">规智助手</span>
          <Badge className={mode === "deep" ? "border-violet-200 bg-violet-50 text-violet-700" : "border-blue-200 bg-blue-50 text-blue-700"}>
            {mode === "deep" ? <Sparkles className="me-1 size-3" /> : <Search className="me-1 size-3" />}
            {mode === "deep" ? "深度检索" : "快速问答"}
          </Badge>
        </div>

        <div className="rounded-2xl rounded-ss-sm border bg-white p-5 shadow-sm">
          <p className="whitespace-pre-wrap text-[15px] leading-7">{getMessageText(message)}</p>

          {status === "insufficient_evidence" && (
            <div className="mt-4 flex gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-800">
              <AlertCircle className="mt-0.5 size-3.5 shrink-0" />
              证据不足：当前回答不可作为确定性结论，请补充项目条件。
            </div>
          )}

          {status === "failed" && (
            <div className="mt-4 flex gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs leading-5 text-rose-700">
              <AlertCircle className="mt-0.5 size-3.5 shrink-0" />
              本次请求未成功完成，你可以稍后重新生成。
            </div>
          )}

          {citations.length > 0 && (
            <button className="mt-4 flex w-full items-center gap-3 rounded-xl border border-blue-100 bg-blue-50/70 p-3 text-start transition hover:border-primary/30" onClick={onCitation}>
              <span className="grid size-8 place-items-center rounded-lg bg-white text-primary">
                <BookOpen className="size-4" />
              </span>
              <span className="flex-1">
                <span className="block text-xs font-semibold text-slate-700">已核验 {citations.length} 条规范依据</span>
                <span className="mt-0.5 block text-[11px] text-muted-foreground">在右侧查看原文片段、版本与页码</span>
              </span>
              <ChevronRight className="size-4 text-primary" />
            </button>
          )}
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-1 text-muted-foreground">
          <ActionButton title={copied ? "已复制" : "复制"} onClick={onCopy}>
            {copied ? <Check className="size-3.5 text-emerald-600" /> : <Clipboard className="size-3.5" />}
          </ActionButton>
          <ActionButton title="收藏" active={bookmarked} onClick={onBookmark}>
            <Bookmark className={cn("size-3.5", bookmarked && "fill-current")} />
          </ActionButton>
          <FeedbackButton disabled={previewMode} messageId={message.id} value="helpful">
            <ThumbsUp className="size-3.5" />
          </FeedbackButton>
          <FeedbackButton disabled={previewMode} messageId={message.id} value="unhelpful">
            <ThumbsDown className="size-3.5" />
          </FeedbackButton>
          <ActionButton title="重新生成" onClick={onRetry}>
            <RefreshCcw className="size-3.5" />
          </ActionButton>
          <ActionButton title="下载报告">
            <Download className="size-3.5" />
          </ActionButton>
          <button className="ms-1 text-[11px] hover:text-primary">纠错</button>
          {latencyMs ? (
            <span className="ms-auto flex items-center gap-1 text-[11px]">
              <Clock3 className="size-3" />
              {(latencyMs / 1000).toFixed(1)}s
            </span>
          ) : null}
        </div>
      </div>
    </article>
  );
}

function Composer({
  input,
  loading,
  mode,
  setInput,
  setMode,
  onSend,
}: {
  input: string;
  loading: boolean;
  mode: ChatMode;
  setInput: (value: string) => void;
  setMode: (mode: ChatMode) => void;
  onSend: () => void;
}) {
  return (
    <div className="rounded-[28px] border bg-[#f8fafb] p-3 shadow-sm">
      <Textarea
        className="min-h-28 resize-none border-0 bg-transparent px-2 py-2 shadow-none focus-visible:ring-0"
        placeholder={mode === "deep" ? "请输入需要多规范比对或复杂推理的问题…" : "请输入想查询的规范问题…"}
        value={input}
        onChange={(event) => setInput(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();
            onSend();
          }
        }}
      />
      <div className="mt-3 flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <button className={cn("rounded-full px-3 py-1.5", mode === "standard" && "bg-white text-primary shadow-sm")} onClick={() => setMode("standard")}>
            快速模式
          </button>
          <button className={cn("rounded-full px-3 py-1.5", mode === "deep" && "bg-white text-violet-700 shadow-sm")} onClick={() => setMode("deep")}>
            深度模式
          </button>
        </div>
        <Button className="rounded-xl" disabled={loading} onClick={onSend}>
          {loading ? <Loader2 className="me-2 size-4 animate-spin" /> : <Send className="me-2 size-4" />}
          发送
        </Button>
      </div>
    </div>
  );
}

function Inspector({
  citations,
  relatedDocuments,
  latestAssistant,
  loading,
  progress,
  selectedCitation,
  setSelectedCitation,
  tab,
  setTab,
  open,
  onClose,
}: {
  citations: Citation[];
  relatedDocuments: RelatedStandardDocument[];
  latestAssistant?: NormMindUIMessage;
  loading: boolean;
  progress: string;
  selectedCitation: number;
  setSelectedCitation: (index: number) => void;
  tab: InspectorTab;
  setTab: (tab: InspectorTab) => void;
  open: boolean;
  onClose: () => void;
}) {
  const citation = citations[selectedCitation];

  return (
    <aside className={cn("fixed inset-y-0 end-0 z-50 flex w-full shrink-0 flex-col border-s bg-[#f8fafb] shadow-xl transition-transform sm:w-[26rem] lg:static lg:z-auto lg:w-84 lg:translate-x-0 lg:shadow-none", open ? "translate-x-0" : "translate-x-full")}>
      <div className="flex h-16 shrink-0 items-center border-b bg-white px-4">
        <div className="grid flex-1 grid-cols-2 rounded-lg bg-secondary p-1 text-xs">
          <button className={cn("rounded-md px-3 py-1.5", tab === "sources" && "bg-white font-medium text-primary shadow-sm")} onClick={() => setTab("sources")}>
            引用原文
          </button>
          <button className={cn("rounded-md px-3 py-1.5", tab === "process" && "bg-white font-medium text-primary shadow-sm")} onClick={() => setTab("process")}>
            处理链路
          </button>
        </div>
        <Button aria-label="关闭面板" className="ms-2 lg:hidden" size="icon" variant="ghost" onClick={onClose}>
          <X className="size-4" />
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {tab === "sources" ? (
          <SourcesPanel
            key={`${citation?.documentTitle ?? "empty"}-${citation?.clause ?? "na"}-${citation?.pageNumber ?? "na"}-${citation?.sourceUrl ?? "na"}`}
            citation={citation}
            citations={citations}
            relatedDocuments={relatedDocuments}
            selectedCitation={selectedCitation}
            setSelectedCitation={setSelectedCitation}
          />
        ) : (
          <ProcessPanel latestAssistant={latestAssistant} loading={loading} progress={progress} />
        )}
      </div>

      <div className="border-t bg-white p-4 text-[11px] leading-5 text-muted-foreground">
        引用来自当前已连接知识库。版本或条款缺失时，请以规范原文和主管部门发布信息为准。
      </div>
    </aside>
  );
}

function SourcesPanel({
  citations,
  citation,
  relatedDocuments,
  selectedCitation,
  setSelectedCitation,
}: {
  citations: Citation[];
  citation?: Citation;
  relatedDocuments: RelatedStandardDocument[];
  selectedCitation: number;
  setSelectedCitation: (index: number) => void;
}) {
  const [sourceViewMode, setSourceViewMode] = useState<SourceViewMode>("excerpt");
  const [copiedLocateHint, setCopiedLocateHint] = useState(false);

  if (!citation && relatedDocuments.length > 0) {
    return <RelatedDocuments documents={relatedDocuments} />;
  }

  if (!citation) {
    return (
      <div className="grid h-full place-items-center py-16 text-center">
        <div>
          <div className="mx-auto grid size-12 place-items-center rounded-2xl bg-secondary text-muted-foreground">
            <BookOpen className="size-5" />
          </div>
          <p className="mt-4 text-sm font-medium">等待规范依据</p>
          <p className="mt-2 text-xs leading-5 text-muted-foreground">提出问题后，引用原文会在这里与回答同步展示。</p>
        </div>
      </div>
    );
  }

  const pageNumber = getPdfPageFromCitation(citation);
  const locateKeywords = getCitationLocateKeywords(citation);
  const locateHint = buildCitationLocateHint(citation);

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold">规范依据</p>
          <p className="mt-1 text-xs text-muted-foreground">共核验 {citations.length} 条</p>
        </div>
        <Badge className="border-emerald-200 bg-emerald-50 text-emerald-700">
          <CheckCircle2 className="me-1 size-3" />
          已引用
        </Badge>
      </div>

      {citations.length > 1 ? (
        <div className="mb-3 flex gap-2 overflow-x-auto pb-1">
          {citations.map((item, index) => (
            <button key={`${item.documentTitle}-${index}`} className={cn("shrink-0 rounded-lg border px-3 py-2 text-xs", selectedCitation === index ? "border-primary bg-blue-50 text-primary" : "bg-white")} onClick={() => setSelectedCitation(index)}>
              依据 {index + 1}
            </button>
          ))}
        </div>
      ) : null}

      <div className="rounded-xl border bg-white p-4 shadow-sm">
        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="grid grid-cols-2 rounded-lg bg-secondary p-1 text-xs">
            <button
              className={cn("rounded-md px-3 py-1.5", sourceViewMode === "excerpt" && "bg-white font-medium text-primary shadow-sm")}
              onClick={() => setSourceViewMode("excerpt")}
            >
              原文片段
            </button>
            <button
              className={cn("rounded-md px-3 py-1.5", sourceViewMode === "pdf" && "bg-white font-medium text-primary shadow-sm")}
              disabled={!canPreviewPdf(citation)}
              onClick={() => setSourceViewMode("pdf")}
            >
              PDF 预览
            </button>
          </div>

          {citation.sourceUrl ? (
            <a
              className="inline-flex items-center justify-center gap-1 rounded-lg border px-2.5 py-1.5 text-[11px] font-medium text-primary hover:bg-blue-50"
              href={citation.sourceUrl}
              rel="noreferrer"
              target="_blank"
            >
              <SquareArrowOutUpRight className="size-3.5" />
              新窗口
            </a>
          ) : null}
        </div>

        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold leading-5">{citation.documentTitle}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {citation.version ?? "版本待核实"} · {citation.clause ?? "条款待核实"}
              {pageNumber ? ` · PDF 第 ${pageNumber} 页` : ""}
            </p>
          </div>
          <FileCheck2 className="size-5 shrink-0 text-primary" />
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          {pageNumber ? <Badge className="border-slate-200 bg-slate-50 text-slate-700">PDF 第 {pageNumber} 页</Badge> : null}
          {citation.clause ? <Badge className="border-slate-200 bg-slate-50 text-slate-700">{citation.clause}</Badge> : null}
          {citation.version ? <Badge className="border-slate-200 bg-slate-50 text-slate-700">{citation.version}</Badge> : null}
        </div>

        <div className="my-4 h-px bg-border" />

        {sourceViewMode === "excerpt" ? (
          <>
            <blockquote className="border-s-2 border-primary/30 ps-3 text-xs leading-6 text-slate-600">
              {citation.excerpt}
            </blockquote>

            <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-[11px] leading-5 text-muted-foreground">
              {pageNumber
                ? `当前可直接定位到 PDF 第 ${pageNumber} 页。段落级高亮仍依赖知识库返回更精确的锚点信息。`
                : "当前引用可展示原文片段，但尚未拿到可靠页码，因此只能打开整份 PDF 供人工核对。"}
            </div>

            <div className="mt-4 rounded-lg border border-blue-100 bg-blue-50/60 p-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold text-slate-800">PDF 定位提示</p>
                  <p className="mt-1 text-[11px] leading-5 text-slate-600">
                    {pageNumber
                      ? `建议先跳到第 ${pageNumber} 页，再结合条款号或下方检索词在页内人工核对。`
                      : "当前还没有可靠页码，建议先打开 PDF，再使用条款号或下方检索词进行全文搜索。"}
                  </p>
                </div>
                <button
                  className="inline-flex shrink-0 items-center gap-1 rounded-lg border bg-white px-2.5 py-1.5 text-[11px] font-medium text-primary hover:bg-blue-50"
                  onClick={async () => {
                    await navigator.clipboard.writeText(locateHint);
                    setCopiedLocateHint(true);
                    window.setTimeout(() => setCopiedLocateHint(false), 1400);
                  }}
                >
                  {copiedLocateHint ? <Check className="size-3.5 text-emerald-600" /> : <Clipboard className="size-3.5" />}
                  {copiedLocateHint ? "已复制" : "复制提示"}
                </button>
              </div>

              {locateKeywords.length > 0 ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {locateKeywords.map((keyword) => (
                    <span key={keyword} className="rounded-full border bg-white px-2.5 py-1 text-[11px] text-slate-600">
                      {keyword}
                    </span>
                  ))}
                </div>
              ) : null}
            </div>

            {citation.sourceUrl ? (
              <a className="mt-4 flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium text-primary hover:bg-blue-50" href={citation.sourceUrl} rel="noreferrer" target="_blank">
                <ExternalLink className="size-3.5" />
                {pageNumber ? `定位到 PDF 第 ${pageNumber} 页` : "查看原文 PDF"}
              </a>
            ) : (
              <div className="mt-4 rounded-lg bg-secondary px-3 py-2 text-[11px] leading-5 text-muted-foreground">
                当前知识库仅提供检索片段，原始 PDF 暂未关联。
              </div>
            )}
          </>
        ) : canPreviewPdf(citation) ? (
          <div>
            <div className="mb-3 flex flex-col gap-2 rounded-lg border border-blue-100 bg-blue-50/70 px-3 py-2 text-[11px] text-slate-600 sm:flex-row sm:items-center sm:justify-between">
              <span className="inline-flex items-center gap-1.5">
                <Boxes className="size-3.5 text-primary" />
                {pageNumber
                  ? `已定位到 PDF 第 ${pageNumber} 页`
                  : "当前仅能预览整份 PDF，未拿到可靠页码"}
              </span>
              <span className="text-muted-foreground">段落高亮待后续锚点增强</span>
            </div>

            <div className="overflow-hidden rounded-xl border bg-slate-100">
              <iframe
                className="h-[58vh] min-h-[360px] w-full bg-white lg:h-[460px]"
                src={citation.sourceUrl}
                title={`${citation.documentTitle} PDF 预览`}
              />
            </div>

            <div className="mt-3 rounded-lg border border-dashed px-3 py-2 text-[11px] leading-5 text-muted-foreground">
              如果页内仍不好找，优先比对条款号
              {citation.clause ? `“${citation.clause}”` : ""}
              {locateKeywords.length > 0 ? `，或搜索：${locateKeywords.join(" / ")}` : "。"}
            </div>
          </div>
        ) : (
          <div className="rounded-lg border border-dashed px-4 py-6 text-center text-[11px] leading-5 text-muted-foreground">
            当前引用未关联可预览的 PDF 文件，请先使用“原文片段”核对，或在知识库中补齐 PDF 映射。
          </div>
        )}
      </div>
    </div>
  );
}

function ProcessPanel({
  loading,
  progress,
  latestAssistant,
}: {
  loading: boolean;
  progress: string;
  latestAssistant?: NormMindUIMessage;
}) {
  const answerMeta = getAnswerMeta(latestAssistant);
  const mode = answerMeta?.mode ?? latestAssistant?.metadata?.mode ?? "standard";
  const delivery = answerMeta?.delivery;
  const traceId = answerMeta?.traceId;
  const status = answerMeta?.status;
  const stages = mode === "deep"
    ? ["理解问题", "拆解任务", "调用 Coze Agent", "核对规范", "整合答案"]
    : ["理解问题", "调用 Coze Agent", "核对引用", "生成回答"];

  return (
    <div className="space-y-4">
      <div className="rounded-xl border bg-white p-4 shadow-sm">
        <p className="text-sm font-semibold">AI 处理链路</p>
        <p className="mt-1 text-xs text-muted-foreground">
          仅展示阶段状态，不暴露模型内部思维链。
        </p>
      </div>

      <div className="space-y-3">
        {stages.map((stage, index) => {
          const active = loading ? stage === progress : true;
          return (
            <div key={stage} className="flex items-start gap-3 rounded-xl border bg-white p-3 shadow-sm">
              <div className={cn("mt-0.5 grid size-7 place-items-center rounded-full text-xs font-semibold", active ? "bg-blue-50 text-primary" : "bg-secondary text-muted-foreground")}>
                {index + 1}
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium">{stage}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {loading && stage === progress ? "进行中…" : "已完成或待触发"}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {latestAssistant ? (
        <div className="rounded-xl border bg-white p-4 text-xs leading-6 text-slate-600 shadow-sm">
          <p><span className="font-medium text-slate-900">结果状态：</span>{status ?? "未知"}</p>
          <p><span className="font-medium text-slate-900">知识代理：</span>{delivery === "coze_workflow_fallback" ? "Coze Workflow 兜底" : "Coze Bot 单轮调用"}</p>
          {traceId ? <p><span className="font-medium text-slate-900">Trace ID：</span>{traceId}</p> : null}
        </div>
      ) : null}
    </div>
  );
}

function RelatedDocuments({ documents }: { documents: RelatedStandardDocument[] }) {
  return (
    <div>
      <div className="mb-4 flex items-center gap-2">
        <FolderOpen className="size-4 text-primary" />
        <p className="text-sm font-semibold">可关联原文</p>
      </div>
        <div className="space-y-3">
          {documents.map((document) => (
          <a key={document.code} className="block rounded-xl border bg-white p-4 shadow-sm transition hover:border-primary/30" href={document.sourceUrl} rel="noreferrer" target="_blank">
            <p className="text-sm font-medium text-slate-900">{document.title}</p>
            <p className="mt-1 text-xs text-muted-foreground">{document.code}</p>
            <p className="mt-2 text-[11px] leading-5 text-muted-foreground">
              当前尚未拿到精确引用锚点，可先打开整份 PDF 进行人工定位。
            </p>
            <p className="mt-3 inline-flex items-center gap-2 text-xs font-medium text-primary">
              <ExternalLink className="size-3.5" />
              打开 PDF 原文
            </p>
          </a>
        ))}
      </div>
    </div>
  );
}

export function LibraryView({
  uploadStep,
  setUploadStep,
}: {
  uploadStep?: number;
  setUploadStep?: (value: number) => void;
}) {
  const pathname = usePathname();
  const [internalUploadStep, setInternalUploadStep] = useState(0);
  const currentUploadStep = uploadStep ?? internalUploadStep;
  const updateUploadStep = setUploadStep ?? setInternalUploadStep;
  const initialDocuments = useMemo(() => getStandardLibraryDocuments(), []);
  const [documents, setDocuments] = useState<StandardLibraryDocument[]>(initialDocuments);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("全部");
  const [statusFilter, setStatusFilter] = useState("全部");
  const [selectedId, setSelectedId] = useState<string>(initialDocuments[0]?.id ?? "");
  const [recentlyPublishedTitle, setRecentlyPublishedTitle] = useState("");
  const [draftUpload, setDraftUpload] = useState({
    fileName: "住宅厨卫通风设计要点（内部整理）.pdf",
    fileType: "PDF",
    category: "建筑" as StandardLibraryDocument["category"],
    version: "2026 试行整理版",
    tags: "住宅, 厨房, 卫生间, 通风",
    summary: "聚合住宅厨房与卫生间的通风设计条文、设备预留和常见核对点，用于企业内部快速检索。",
    publishScope: "全库",
  });

  const filteredDocuments = useMemo(() => {
    return documents.filter((document) => {
      const matchQuery =
        query.trim().length === 0 ||
        `${document.title} ${document.code} ${document.tags.join(" ")} ${document.summary}`
          .toLowerCase()
          .includes(query.trim().toLowerCase());
      const matchCategory = category === "全部" || document.category === category;
      const matchStatus = statusFilter === "全部" || document.status === statusFilter;
      return matchQuery && matchCategory && matchStatus;
    });
  }, [category, documents, query, statusFilter]);

  const selectedDocument =
    filteredDocuments.find((document) => document.id === selectedId) ??
    filteredDocuments[0] ??
    null;

  const uploadFlowNotes = {
    0: "支持上传 PDF、Word、CSV 等规范资料，后续将接入真实存储与权限边界。",
    1: "模拟 Coze / 外部知识库解析状态，后续可替换为真实任务队列与进度回调。",
    2: "在标签确认阶段补齐专业分类、版本、生效状态和业务标签。",
    3: "发布后进入知识库可检索范围，并可挂接企业库或指定规范范围。",
  } as const;

  const parsedTags = draftUpload.tags
    .split(/[，,]/)
    .map((item) => item.trim())
    .filter(Boolean);

  const publishDraftDocument = () => {
    const nextDocument: StandardLibraryDocument = {
      id: `draft-${crypto.randomUUID()}`,
      title: draftUpload.fileName.replace(/\.(pdf|docx?|csv)$/i, ""),
      code: `企业资料 / ${draftUpload.fileType}`,
      version: draftUpload.version,
      category: draftUpload.category,
      status: "已发布",
      updatedAt: "刚刚",
      chunks: 128,
      tags: parsedTags.length > 0 ? parsedTags : ["待补标签"],
      sourceUrl: "/standards/GB50096-2011%20住宅设计规范.pdf",
      summary: draftUpload.summary,
    };

    setDocuments((current) => [nextDocument, ...current]);
    setSelectedId(nextDocument.id);
    setRecentlyPublishedTitle(nextDocument.title);
    setStatusFilter("全部");
    setQuery("");
  };

  return (
    <div className="grid gap-6 p-6 xl:grid-cols-[1.15fr_0.85fr]">
      <div className="rounded-[28px] border bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-lg font-semibold text-slate-900">规范资料库</p>
            <p className="mt-1 text-sm text-muted-foreground">支持按规范名称、专业分类、状态和标签浏览资料，并查看详情。</p>
          </div>
          <Button onClick={() => updateUploadStep(0)}>
            <Upload className="me-2 size-4" />
            上传资料
          </Button>
        </div>

        <div className="mt-6 grid gap-3 md:grid-cols-[1.3fr_0.7fr_0.7fr]">
          <label className="block">
            <span className="mb-2 block text-xs font-medium text-muted-foreground">搜索规范</span>
            <div className="flex items-center gap-2 rounded-2xl border bg-slate-50 px-3 py-2.5">
              <FileSearch className="size-4 text-muted-foreground" />
              <input
                className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                placeholder="名称 / 编号 / 标签"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </div>
          </label>
          <label className="block">
            <span className="mb-2 block text-xs font-medium text-muted-foreground">专业分类</span>
            <select className="w-full rounded-2xl border bg-slate-50 px-3 py-2.5 text-sm outline-none" value={category} onChange={(event) => setCategory(event.target.value)}>
              {["全部", "建筑", "规划", "景观", "市政", "暖通"].map((item) => (
                <option key={item} value={item}>{item}</option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-2 block text-xs font-medium text-muted-foreground">资料状态</span>
            <select className="w-full rounded-2xl border bg-slate-50 px-3 py-2.5 text-sm outline-none" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
              {["全部", "已发布", "解析中", "待补标签"].map((item) => (
                <option key={item} value={item}>{item}</option>
              ))}
            </select>
          </label>
        </div>

        <div className="mt-5 rounded-2xl border">
          <div className="flex items-center justify-between border-b px-4 py-3">
            <div>
              <p className="text-sm font-semibold text-slate-900">资料列表</p>
              <p className="mt-1 text-xs text-muted-foreground">当前共 {filteredDocuments.length} 份资料</p>
            </div>
            <Badge className="border-blue-200 bg-blue-50 text-blue-700">资料库</Badge>
          </div>

          <div className="max-h-[560px] overflow-y-auto p-3">
            <div className="space-y-3">
              {filteredDocuments.length === 0 ? (
                <div className="rounded-2xl border border-dashed px-4 py-10 text-center text-sm text-muted-foreground">
                  没有匹配的规范资料，试试更换关键词或分类。
                </div>
              ) : null}

              {filteredDocuments.map((document) => (
                <button
                  key={document.id}
                  className={cn(
                    "w-full rounded-2xl border p-4 text-left transition",
                    selectedDocument?.id === document.id ? "border-primary bg-blue-50/50" : "bg-white hover:border-primary/30",
                  )}
                  onClick={() => setSelectedId(document.id)}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-900">{document.title}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{document.code}</p>
                    </div>
                    <Badge className={
                      document.status === "已发布"
                        ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                        : document.status === "解析中"
                          ? "border-amber-200 bg-amber-50 text-amber-700"
                          : "border-slate-200 bg-slate-100 text-slate-700"
                    }>
                      {document.status}
                    </Badge>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-muted-foreground">
                    <span>{document.category}</span>
                    <span>版本：{document.version}</span>
                    <span>片段：{document.chunks}</span>
                    <span>更新：{document.updatedAt}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-6">
        <div className="rounded-[28px] border bg-white p-6 shadow-sm">
          <div className="flex items-center gap-2">
            <BookOpen className="size-4 text-primary" />
            <p className="text-lg font-semibold">资料详情</p>
          </div>

          {selectedDocument ? (
            <div className="mt-6">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-lg font-semibold text-slate-900">{selectedDocument.title}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{selectedDocument.code}</p>
                </div>
                <Badge className="border-blue-200 bg-blue-50 text-blue-700">{selectedDocument.category}</Badge>
              </div>

              <p className="mt-4 text-sm leading-7 text-slate-600">{selectedDocument.summary}</p>

              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <DetailStat label="版本" value={selectedDocument.version} />
                <DetailStat label="状态" value={selectedDocument.status} />
                <DetailStat label="更新时间" value={selectedDocument.updatedAt} />
                <DetailStat label="知识片段" value={`${selectedDocument.chunks}`} />
              </div>

              <div className="mt-5">
                <p className="text-xs font-medium text-muted-foreground">标签</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {selectedDocument.tags.map((tag) => (
                    <Badge key={tag} className="border-slate-200 bg-slate-50 text-slate-700">{tag}</Badge>
                  ))}
                </div>
              </div>

              <div className="mt-6 flex flex-wrap gap-3">
                <a className="inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium text-primary hover:bg-blue-50" href={selectedDocument.sourceUrl} rel="noreferrer" target="_blank">
                  <ExternalLink className="size-4" />
                  打开原文 PDF
                </a>
                <Button variant="outline">设为推荐范围</Button>
                <Link
                  className="inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium text-primary hover:bg-blue-50"
                  href={pathname === "/library" ? `/library/${selectedDocument.id}` : `/library/${selectedDocument.id}?preview=1`}
                >
                  查看详情页
                  <ArrowRight className="size-4" />
                </Link>
              </div>
            </div>
          ) : (
            <div className="mt-6 rounded-2xl border border-dashed px-4 py-10 text-center text-sm text-muted-foreground">
              暂无可查看的资料详情。
            </div>
          )}
        </div>

        <div className="rounded-[28px] border bg-white p-6 shadow-sm">
          <div className="flex items-center gap-2">
            <Settings className="size-4 text-primary" />
            <p className="text-lg font-semibold">入库流程</p>
          </div>

          {recentlyPublishedTitle ? (
            <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
              <p className="font-medium">已发布到资料库</p>
              <p className="mt-1 text-xs leading-5">{recentlyPublishedTitle} 已进入可检索范围，并出现在左侧资料列表顶部。</p>
            </div>
          ) : null}

          <div className="mt-6 space-y-3">
            {["上传文件", "智能解析", "标签确认", "发布入库"].map((step, index) => (
              <button key={step} className={cn("flex w-full items-center gap-3 rounded-2xl border p-4 text-left", currentUploadStep === index ? "border-primary bg-blue-50/50" : "bg-white")} onClick={() => updateUploadStep(index)}>
                <div className={cn("grid size-8 place-items-center rounded-full text-xs font-semibold", currentUploadStep >= index ? "bg-primary text-white" : "bg-secondary text-muted-foreground")}>
                  {index + 1}
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-900">{step}</p>
                  <p className="mt-1 text-xs text-muted-foreground">用于演示资料从上传到可检索发布的最小闭环</p>
                </div>
              </button>
            ))}
          </div>

          <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-sm font-medium text-slate-900">当前步骤说明</p>
            <p className="mt-2 text-xs leading-6 text-muted-foreground">
              {uploadFlowNotes[currentUploadStep as 0 | 1 | 2 | 3]}
            </p>
          </div>

          <div className="mt-5 rounded-2xl border bg-white p-4">
            {currentUploadStep === 0 ? (
              <div>
                <p className="text-sm font-medium text-slate-900">1. 上传文件</p>
                <div className="mt-4 space-y-4">
                  <label className="block">
                    <span className="mb-2 block text-xs font-medium text-muted-foreground">资料名称</span>
                    <input
                      className="w-full rounded-2xl border bg-slate-50 px-3 py-2.5 text-sm outline-none"
                      value={draftUpload.fileName}
                      onChange={(event) => setDraftUpload((current) => ({ ...current, fileName: event.target.value }))}
                    />
                  </label>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className="block">
                      <span className="mb-2 block text-xs font-medium text-muted-foreground">文件类型</span>
                      <select
                        className="w-full rounded-2xl border bg-slate-50 px-3 py-2.5 text-sm outline-none"
                        value={draftUpload.fileType}
                        onChange={(event) => setDraftUpload((current) => ({ ...current, fileType: event.target.value }))}
                      >
                        {["PDF", "Word", "CSV"].map((item) => (
                          <option key={item} value={item}>{item}</option>
                        ))}
                      </select>
                    </label>
                    <label className="block">
                      <span className="mb-2 block text-xs font-medium text-muted-foreground">建议分类</span>
                      <select
                        className="w-full rounded-2xl border bg-slate-50 px-3 py-2.5 text-sm outline-none"
                        value={draftUpload.category}
                        onChange={(event) => setDraftUpload((current) => ({ ...current, category: event.target.value as StandardLibraryDocument["category"] }))}
                      >
                        {["建筑", "规划", "景观", "市政", "暖通"].map((item) => (
                          <option key={item} value={item}>{item}</option>
                        ))}
                      </select>
                    </label>
                  </div>
                  <div className="rounded-2xl border border-dashed bg-slate-50 px-4 py-4 text-xs leading-6 text-muted-foreground">
                    当前为前端原型：这里模拟上传成功，后续会接入真实文件存储、解析队列和权限控制。
                  </div>
                  <Button className="w-full" onClick={() => updateUploadStep(1)}>
                    开始解析
                  </Button>
                </div>
              </div>
            ) : null}

            {currentUploadStep === 1 ? (
              <div>
                <p className="text-sm font-medium text-slate-900">2. 智能解析</p>
                <div className="mt-4 space-y-4">
                  {[
                    { label: "文件抽取", value: 100, detail: "PDF 文本已抽取" },
                    { label: "条文切片", value: 84, detail: "已生成 128 个知识片段" },
                    { label: "元数据识别", value: 76, detail: "已识别版本、专业与部分标签" },
                  ].map((item) => (
                    <div key={item.label}>
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-medium text-slate-700">{item.label}</span>
                        <span className="text-muted-foreground">{item.value}%</span>
                      </div>
                      <div className="mt-2 h-2 rounded-full bg-slate-100">
                        <div className="h-2 rounded-full bg-primary" style={{ width: `${item.value}%` }} />
                      </div>
                      <p className="mt-1 text-[11px] text-muted-foreground">{item.detail}</p>
                    </div>
                  ))}
                  <div className="rounded-2xl border bg-blue-50/50 px-4 py-3 text-xs leading-6 text-slate-600">
                    当前模拟 Coze / 外部知识库回调结果：已识别为 {draftUpload.category} 类资料，建议标签 {parsedTags.slice(0, 3).join("、") || "住宅、通风"}。
                  </div>
                  <Button className="w-full" onClick={() => updateUploadStep(2)}>
                    进入标签确认
                  </Button>
                </div>
              </div>
            ) : null}

            {currentUploadStep === 2 ? (
              <div>
                <p className="text-sm font-medium text-slate-900">3. 标签确认</p>
                <div className="mt-4 space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className="block">
                      <span className="mb-2 block text-xs font-medium text-muted-foreground">规范版本</span>
                      <input
                        className="w-full rounded-2xl border bg-slate-50 px-3 py-2.5 text-sm outline-none"
                        value={draftUpload.version}
                        onChange={(event) => setDraftUpload((current) => ({ ...current, version: event.target.value }))}
                      />
                    </label>
                    <label className="block">
                      <span className="mb-2 block text-xs font-medium text-muted-foreground">专业分类</span>
                      <select
                        className="w-full rounded-2xl border bg-slate-50 px-3 py-2.5 text-sm outline-none"
                        value={draftUpload.category}
                        onChange={(event) => setDraftUpload((current) => ({ ...current, category: event.target.value as StandardLibraryDocument["category"] }))}
                      >
                        {["建筑", "规划", "景观", "市政", "暖通"].map((item) => (
                          <option key={item} value={item}>{item}</option>
                        ))}
                      </select>
                    </label>
                  </div>
                  <label className="block">
                    <span className="mb-2 block text-xs font-medium text-muted-foreground">业务标签</span>
                    <input
                      className="w-full rounded-2xl border bg-slate-50 px-3 py-2.5 text-sm outline-none"
                      value={draftUpload.tags}
                      onChange={(event) => setDraftUpload((current) => ({ ...current, tags: event.target.value }))}
                    />
                  </label>
                  <label className="block">
                    <span className="mb-2 block text-xs font-medium text-muted-foreground">资料摘要</span>
                    <Textarea
                      className="min-h-24 rounded-2xl border bg-slate-50 text-sm shadow-none focus-visible:ring-0"
                      value={draftUpload.summary}
                      onChange={(event) => setDraftUpload((current) => ({ ...current, summary: event.target.value }))}
                    />
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {parsedTags.map((tag) => (
                      <Badge key={tag} className="border-slate-200 bg-slate-50 text-slate-700">{tag}</Badge>
                    ))}
                  </div>
                  <Button className="w-full" onClick={() => updateUploadStep(3)}>
                    确认并准备发布
                  </Button>
                </div>
              </div>
            ) : null}

            {currentUploadStep === 3 ? (
              <div>
                <p className="text-sm font-medium text-slate-900">4. 发布入库</p>
                <div className="mt-4 space-y-4">
                  <div className="rounded-2xl border bg-slate-50 p-4">
                    <p className="text-sm font-semibold text-slate-900">{draftUpload.fileName.replace(/\.(pdf|docx?|csv)$/i, "")}</p>
                    <div className="mt-3 grid gap-3 sm:grid-cols-2">
                      <DetailStat label="版本" value={draftUpload.version} />
                      <DetailStat label="分类" value={draftUpload.category} />
                      <DetailStat label="建议范围" value={draftUpload.publishScope} />
                      <DetailStat label="预计片段数" value="128" />
                    </div>
                  </div>
                  <label className="block">
                    <span className="mb-2 block text-xs font-medium text-muted-foreground">发布范围</span>
                    <select
                      className="w-full rounded-2xl border bg-slate-50 px-3 py-2.5 text-sm outline-none"
                      value={draftUpload.publishScope}
                      onChange={(event) => setDraftUpload((current) => ({ ...current, publishScope: event.target.value }))}
                    >
                      {["全库", "企业库", "指定规范范围"].map((item) => (
                        <option key={item} value={item}>{item}</option>
                      ))}
                    </select>
                  </label>
                  <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-6 text-amber-800">
                    发布后，这份资料会进入知识库可检索范围；当前原型仅更新前端状态，不会真实写入外部知识库。
                  </div>
                  <Button
                    className="w-full"
                    onClick={() => {
                      publishDraftDocument();
                    }}
                  >
                    发布到资料库
                  </Button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

export function AccountSettingsView({
  previewMode = false,
}: {
  previewMode?: boolean;
}) {
  return (
    <div className="grid gap-6 p-6 xl:grid-cols-[0.95fr_1.05fr]">
      <div className="space-y-6">
        <div className="rounded-[28px] border bg-white p-6 shadow-sm">
          <div className="flex items-center gap-2">
            <User className="size-4 text-primary" />
            <p className="text-lg font-semibold">账户设置</p>
          </div>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            管理登录方式、默认问答偏好和结果提示策略。当前为 MVP 骨架，后续会接入真实用户资料与组织权限。
          </p>

          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <DetailStat label="账户状态" value={previewMode ? "体验模式" : "已登录用户"} />
            <DetailStat label="默认语言" value="中文" />
            <DetailStat label="默认模式" value="快速问答" />
            <DetailStat label="默认检索范围" value="全库" />
          </div>
        </div>

        <div className="rounded-[28px] border bg-white p-6 shadow-sm">
          <p className="text-base font-semibold text-slate-900">登录方式</p>
          <div className="mt-4 space-y-3">
            {[
              ["邮箱登录", "已开放，当前推荐作为正式登录方式。"],
              ["手机号登录", "短信服务待配置，开放后可用于验证码登录。"],
              ["微信登录", "OAuth 回调与应用配置待完成，后续开放。"],
            ].map(([title, description], index) => (
              <div key={title} className="rounded-2xl border bg-slate-50 px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-medium text-slate-900">{title}</p>
                  <Badge className={index === 0 ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-amber-200 bg-amber-50 text-amber-700"}>
                    {index === 0 ? "已开放" : "即将开放"}
                  </Badge>
                </div>
                <p className="mt-2 text-xs leading-5 text-muted-foreground">{description}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="space-y-6">
        <div className="rounded-[28px] border bg-white p-6 shadow-sm">
          <div className="flex items-center gap-2">
            <Settings className="size-4 text-primary" />
            <p className="text-lg font-semibold">问答偏好</p>
          </div>

          <div className="mt-6 space-y-4">
            <SettingRow
              title="默认展示引用原文"
              description="回答生成后自动打开右侧引用面板，适合审阅型工作流。"
              status="已启用"
            />
            <SettingRow
              title="证据不足强提醒"
              description="当引用不足时，显著提示不可直接作为设计或审查结论。"
              status="已启用"
            />
            <SettingRow
              title="深度检索状态展示"
              description="仅展示任务阶段，不暴露模型内部思维链。"
              status="已启用"
            />
          </div>
        </div>

        <div className="rounded-[28px] border bg-white p-6 shadow-sm">
          <p className="text-base font-semibold text-slate-900">后续预留</p>
          <div className="mt-4 space-y-3 text-sm leading-6 text-muted-foreground">
            <div className="rounded-2xl border border-dashed px-4 py-3">
              企业组织与成员权限
            </div>
            <div className="rounded-2xl border border-dashed px-4 py-3">
              收藏夹、报告导出与会话搜索
            </div>
            <div className="rounded-2xl border border-dashed px-4 py-3">
              个人常用规范范围与企业知识库偏好
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function AdminOpsView({
  previewMode = false,
}: {
  previewMode?: boolean;
}) {
  return (
    <div className="grid gap-6 p-6 xl:grid-cols-[0.92fr_1.08fr]">
      <div className="space-y-6">
        <div className="rounded-[28px] border bg-white p-6 shadow-sm">
          <div className="flex items-center gap-2">
            <ShieldCheck className="size-4 text-primary" />
            <p className="text-lg font-semibold">管理后台概览</p>
          </div>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            面向 QA 样本、评测、反馈与 Agent 调优的最小后台骨架。当前为演示版，后续会接入真实权限与数据表。
          </p>

          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <DetailStat label="后台状态" value={previewMode ? "体验模式" : "管理员模式"} />
            <DetailStat label="评测集数量" value="3 套" />
            <DetailStat label="待处理反馈" value="7 条" />
            <DetailStat label="最近评测通过率" value="87%" />
          </div>
        </div>

        <div className="rounded-[28px] border bg-white p-6 shadow-sm">
          <div className="flex items-center gap-2">
            <ClipboardList className="size-4 text-primary" />
            <p className="text-lg font-semibold">QA 样本管理</p>
          </div>
          <div className="mt-4 space-y-3">
            {qaSampleGroups.map((group) => (
              <div key={group.title} className="rounded-2xl border bg-slate-50 px-4 py-3">
                <p className="text-sm font-medium text-slate-900">{group.title}</p>
                <p className="mt-2 text-xs leading-5 text-muted-foreground">{group.description}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-[28px] border bg-white p-6 shadow-sm">
          <div className="flex items-center gap-2">
            <Bot className="size-4 text-primary" />
            <p className="text-lg font-semibold">Agent 配置</p>
          </div>
          <div className="mt-4 space-y-4">
            {agentConfigs.map((item) => (
              <SettingRow
                key={item.title}
                title={item.title}
                description={item.description}
                status={item.status}
              />
            ))}
          </div>
        </div>
      </div>

      <div className="space-y-6">
        <div className="rounded-[28px] border bg-white p-6 shadow-sm">
          <div className="flex items-center gap-2">
            <FlaskConical className="size-4 text-primary" />
            <p className="text-lg font-semibold">评测系统</p>
          </div>
          <div className="mt-4 space-y-3">
            {evalSuites.map((suite) => (
              <div key={suite.name} className="rounded-2xl border bg-slate-50 px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-slate-900">{suite.name}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{suite.count} 道样本 · 最近一次回归结果</p>
                  </div>
                  <Badge className={suite.status === "已达标" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-amber-200 bg-amber-50 text-amber-700"}>
                    {suite.status}
                  </Badge>
                </div>
                <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                  <span>通过率</span>
                  <span className="font-medium text-slate-700">{suite.score}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-[28px] border bg-white p-6 shadow-sm">
          <div className="flex items-center gap-2">
            <MessageSquareWarning className="size-4 text-primary" />
            <p className="text-lg font-semibold">用户反馈与问题工单</p>
          </div>
          <div className="mt-4 space-y-3">
            {feedbackItems.map((item) => (
              <div key={item.title} className="rounded-2xl border bg-slate-50 px-4 py-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-slate-900">{item.title}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{item.source} · {item.time}</p>
                  </div>
                  <Badge className={item.severity === "高" ? "border-rose-200 bg-rose-50 text-rose-700" : "border-amber-200 bg-amber-50 text-amber-700"}>
                    {item.severity}优先级
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-[28px] border bg-white p-6 shadow-sm">
          <div className="flex items-center gap-2">
            <BarChart3 className="size-4 text-primary" />
            <p className="text-lg font-semibold">运营与质量监控</p>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {qualityMetrics.map((metric) => (
              <DetailStat key={metric.label} label={metric.label} value={metric.value} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function DetailStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border bg-slate-50 px-4 py-3">
      <p className="text-[11px] font-medium text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-semibold text-slate-900">{value}</p>
    </div>
  );
}

function SettingRow({
  title,
  description,
  status,
}: {
  title: string;
  description: string;
  status: string;
}) {
  return (
    <div className="rounded-2xl border bg-slate-50 px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-slate-900">{title}</p>
        <Badge className="border-blue-200 bg-blue-50 text-blue-700">{status}</Badge>
      </div>
      <p className="mt-2 text-xs leading-5 text-muted-foreground">{description}</p>
    </div>
  );
}

function ActionButton({
  title,
  children,
  onClick,
  active = false,
}: {
  title: string;
  children: React.ReactNode;
  onClick?: () => void;
  active?: boolean;
}) {
  return (
    <button className={cn("inline-flex items-center justify-center rounded-lg px-2 py-1.5 text-xs transition hover:bg-secondary", active && "bg-secondary text-primary")} title={title} onClick={onClick}>
      {children}
    </button>
  );
}

function FeedbackButton({
  messageId,
  value,
  children,
  disabled,
}: {
  messageId: string;
  value: "helpful" | "unhelpful";
  children: React.ReactNode;
  disabled: boolean;
}) {
  const [sent, setSent] = useState(false);

  return (
    <Button
      aria-label={value === "helpful" ? "有帮助" : "无帮助"}
      title={value === "helpful" ? "有帮助" : "无帮助"}
      disabled={disabled || sent}
      size="icon"
      variant="ghost"
      onClick={async () => {
        const response = await fetch("/api/feedback", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messageId, rating: value }),
        });
        if (response.ok) setSent(true);
      }}
    >
      {sent ? <Check className="size-3.5 text-emerald-600" /> : children}
    </Button>
  );
}
