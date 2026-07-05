import { z } from "zod";
import { createAgent, humanInTheLoopMiddleware, tool, type ToolRuntime } from "langchain";
import { MemorySaver } from "@langchain/langgraph";
import { MultiServerMCPClient } from "@langchain/mcp-adapters";
import { ChatOpenAI } from "@langchain/openai";
import type { ChatMode, Citation, CozeAnswer } from "@/lib/chat";
import { runCozeKnowledgeAgent } from "@/lib/coze";

type AgentTurnCapture = {
  citations: Citation[];
  status: CozeAnswer["status"];
  traceId: string;
  latencyMs: number;
  delivery: CozeAnswer["delivery"];
};

type CreateNormMindAgentOptions = {
  mode: ChatMode;
  scope?: string;
  capture: AgentTurnCapture;
};

async function loadOptionalMcpTools() {
  const command = process.env.STITCH_MCP_COMMAND;
  if (!command) return [];

  const client = new MultiServerMCPClient({
    throwOnLoadError: false,
    prefixToolNameWithServerName: true,
    useStandardContentBlocks: true,
    onConnectionError: "ignore",
    mcpServers: {
      stitch: {
        transport: "stdio",
        command,
        args: process.env.STITCH_MCP_ARGS?.split(" ").filter(Boolean) ?? [],
      },
    },
  });

  try {
    return await client.getTools();
  } catch (error) {
    console.warn("stitch_mcp_tools_unavailable", error);
    return [];
  }
}

export async function createNormMindAgent({
  mode,
  scope,
  capture,
}: CreateNormMindAgentOptions) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  const modelName = process.env.OPENROUTER_MODEL;

  if (!apiKey || !modelName) {
    throw new Error("OpenRouter 环境变量尚未配置");
  }

  const model = new ChatOpenAI({
    apiKey,
    model: modelName,
    temperature: 0.1,
    streamUsage: false,
    configuration: {
      baseURL: process.env.OPENROUTER_BASE_URL ?? "https://openrouter.ai/api/v1",
      defaultHeaders: {
        "HTTP-Referer": "https://normmind.local",
        "X-Title": "NormMind",
      },
    },
  });

  const cozeTool = tool(
    async (
      input: {
        question: string;
        mode: ChatMode;
        scope?: string;
      },
      runtime?: ToolRuntime,
    ) => {
      runtime?.writer?.({
        type: "pipeline",
        id: "coze-agent",
        step: "调用 Coze 规范知识代理",
        state: "loading",
        detail: input.scope ? `检索范围：${input.scope}` : "检索范围：全库",
      });

      const answer = await runCozeKnowledgeAgent(input.question, input.mode);
      capture.citations = answer.citations;
      capture.status = answer.status;
      capture.traceId = answer.traceId;
      capture.latencyMs = answer.latencyMs;
      capture.delivery = answer.delivery;

      runtime?.writer?.({
        type: "pipeline",
        id: "coze-agent",
        step: answer.status === "completed" ? "已完成规范核验" : "证据不足，建议人工复核",
        state: answer.status === "failed" ? "error" : "success",
        detail: answer.citations.length > 0 ? `命中 ${answer.citations.length} 条依据` : "未返回可核验引用",
      });
      runtime?.writer?.({
        type: "answerMeta",
        id: "answer-meta",
        mode: input.mode,
        status: answer.status,
        citations: answer.citations,
        traceId: answer.traceId,
        latencyMs: answer.latencyMs,
        delivery: answer.delivery,
      });

      return answer;
    },
    {
      name: "coze_norm_query",
      description: "查询 Coze 建筑规范 Agent，返回中文答案、引用条款、版本信息和追踪标识。",
      schema: z.object({
        question: z.string().min(2).max(2000),
        mode: z.enum(["standard", "deep"]),
        scope: z.string().optional(),
      }),
    },
  );

  const mcpTools = await loadOptionalMcpTools();
  const middleware =
    process.env.AGENT_ENABLE_HITL === "1"
      ? [humanInTheLoopMiddleware({ interruptOn: {} })]
      : [];

  return createAgent({
    model,
    tools: [cozeTool, ...mcpTools],
    middleware,
    checkpointer: new MemorySaver(),
    systemPrompt: [
      "你是规智（NormMind）规范智能助手，回答必须使用中文。",
      "产品中文名称只能使用“规智”，不得使用“元规”。",
      "面对建筑、规划、景观规范问题时，必须优先调用 coze_norm_query 工具获取依据。",
      "如果工具返回 status=insufficient_evidence，必须明确写出“证据不足”，不得给出确定性结论。",
      "回答结构优先使用：结论、适用条件、风险提示。",
      "不得编造条文编号、版本、页码或引用内容。",
      `当前默认模式：${mode === "deep" ? "深度检索" : "快速问答"}。`,
      `当前默认检索范围：${scope || "全库"}。`,
    ].join("\n"),
  });
}
