import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { requireUser, unauthorized } from "@/lib/auth";
import type { ChatMode, Citation, NormMindUIMessage } from "@/lib/chat";
import { isDevelopment } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

type SeedConversation = {
  title: string;
  mode: ChatMode;
  userQuestion: string;
  assistantAnswer: string;
  citations: Citation[];
};

const seedConversations: SeedConversation[] = [
  {
    title: "住宅厨房与卫生间通风建议",
    mode: "standard",
    userQuestion: "住宅厨房与卫生间通风设计应遵循哪些建议？",
    assistantAnswer:
      "建议优先核对住宅设计规范与暖通规范中的自然通风、排风组织和防串味要求。厨房宜设置直接排至室外的排油烟设施，卫生间宜设置有效排风，并结合门下缝或补风路径保证气流组织。对于高层住宅和集中竖井场景，还应核对防火分隔、止回、防倒灌与噪声控制要求。",
    citations: [
      {
        documentTitle: "住宅设计规范",
        version: "GB 50096-2011",
        clause: "7.2.1",
        excerpt: "厨房和卫生间应有通风措施。",
        sourceUrl: "/standards/GB50096-2011%20%E4%BD%8F%E5%AE%85%E8%AE%BE%E8%AE%A1%E8%A7%84%E8%8C%83.pdf",
      },
      {
        documentTitle: "民用建筑供暖通风与空气调节设计规范",
        version: "GB 50736-2012",
        clause: "6.3.4",
        excerpt: "排风系统设计应避免污浊空气倒灌，并应保证必要的补风条件。",
        sourceUrl:
          "/standards/GB%2050736-2012%20%E6%B0%91%E7%94%A8%E5%BB%BA%E7%AD%91%E4%BE%9B%E6%9A%96%E9%80%9A%E9%A3%8E%E4%B8%8E%E7%A9%BA%E6%B0%94%E8%B0%83%E8%8A%82%E8%AE%BE%E8%AE%A1%E8%A7%84%E8%8C%83.pdf",
      },
    ],
  },
  {
    title: "无障碍住房条文理解",
    mode: "deep",
    userQuestion: "《住宅建筑规范》中“无障碍住房”是什么意思？",
    assistantAnswer:
      "无障碍住房通常指满足轮椅使用者、老年人等行动不便群体基本通行和使用要求的住宅套型。实际判断时，应进一步核对入口、通道、卫生间、厨房、起居空间的尺寸与设施要求，并确认适用版本和项目所在地补充标准。",
    citations: [
      {
        documentTitle: "住宅建筑规范",
        version: "GB 50368-2005",
        clause: "5.3",
        excerpt: "住宅应按规定设置无障碍住房，并对入口、交通联系空间等进行相应设计。",
        sourceUrl:
          "/standards/GB%2050368-2005%20%E4%BD%8F%E5%AE%85%E5%BB%BA%E7%AD%91%E8%A7%84%E8%8C%83.pdf#page=17&zoom=page-width",
        pageNumber: 17,
      },
    ],
  },
  {
    title: "消防车道宽度多规范比对",
    mode: "deep",
    userQuestion: "比较两个规范对消防车道宽度的要求。",
    assistantAnswer:
      "这类问题必须先明确适用场景，例如总平面消防车道、环形车道、登高操作场地或市政道路接驳。不同规范对最小宽度、转弯半径、净空和承载要求的表述会不同，回答时应逐条列出适用条件，不能只给一个孤立数字。",
    citations: [
      {
        documentTitle: "建筑设计防火规范",
        version: "GB 50016-2014",
        clause: "7.1.8",
        excerpt: "消防车道的设置应满足消防车通行和扑救作业要求。",
        sourceUrl:
          "/standards/GB%2050016-2014%E3%80%8A%E5%BB%BA%E7%AD%91%E8%AE%BE%E8%AE%A1%E9%98%B2%E7%81%AB%E8%A7%84%E8%8C%83%E3%80%8B.pdf",
      },
      {
        documentTitle: "城市道路交通工程项目规范",
        version: "GB 55011-2021",
        clause: "4.2.2",
        excerpt: "道路横断面和通行净空应结合通行对象与作业需求综合确定。",
        sourceUrl:
          "/standards/GB55011-2021%E5%9F%8E%E5%B8%82%E9%81%93%E8%B7%AF%E4%BA%A4%E9%80%9A%E5%B7%A5%E7%A8%8B%E9%A1%B9%E7%9B%AE%E8%A7%84%E8%8C%83%EF%BC%88GB%2055011-2021%EF%BC%89.pdf",
      },
    ],
  },
];

function makeMessage({
  id,
  role,
  text,
  mode,
  citations = [],
}: {
  id: string;
  role: "user" | "assistant";
  text: string;
  mode: ChatMode;
  citations?: Citation[];
}): NormMindUIMessage {
  if (role === "assistant") {
    return {
      id,
      role,
      metadata: { mode },
      parts: [
        { type: "text", text },
        {
          type: "data-answerMeta",
          id: `answer-meta-${id}`,
          data: {
            mode,
            status: "completed",
            citations,
            traceId: `seed-${id}`,
            latencyMs: 1600,
            delivery: "coze_bot_v3",
          },
        },
      ],
    };
  }

  return {
    id,
    role,
    metadata: { mode },
    parts: [{ type: "text", text }],
  };
}

export async function POST() {
  if (!isDevelopment) {
    return NextResponse.json({ error: "仅开发环境可生成测试数据" }, { status: 403 });
  }

  const user = await requireUser();
  if (!user || user.id === "preview-user") return unauthorized();

  const supabase = await createClient();
  const insertedIds: string[] = [];

  for (const item of seedConversations) {
    const conversationId = randomUUID();
    const userMessageId = randomUUID();
    const assistantMessageId = randomUUID();
    const messages = [
      makeMessage({
        id: userMessageId,
        role: "user",
        text: item.userQuestion,
        mode: item.mode,
      }),
      makeMessage({
        id: assistantMessageId,
        role: "assistant",
        text: item.assistantAnswer,
        mode: item.mode,
        citations: item.citations,
      }),
    ];

    const { error: conversationError } = await supabase.from("conversations").insert({
      id: conversationId,
      user_id: user.id,
      title: item.title,
      messages_json: messages,
      last_mode: item.mode,
      last_message_preview: item.assistantAnswer.slice(0, 240),
    });

    if (conversationError) {
      return NextResponse.json({ error: "测试会话生成失败" }, { status: 500 });
    }

    const { error: assistantError } = await supabase.from("messages").insert({
      id: assistantMessageId,
      conversation_id: conversationId,
      user_id: user.id,
      role: "assistant",
      content: item.assistantAnswer,
      mode: item.mode,
      status: "completed",
      citations_json: item.citations,
      trace_id: `seed-${assistantMessageId}`,
      latency_ms: 1600,
    });

    if (assistantError) {
      return NextResponse.json({ error: "测试回答审计记录生成失败" }, { status: 500 });
    }

    insertedIds.push(conversationId);
  }

  const { data: conversations, error: listError } = await supabase
    .from("conversations")
    .select("id,title,updated_at")
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false })
    .limit(100);

  if (listError) {
    return NextResponse.json({ error: "测试数据生成完成，但刷新列表失败" }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    seededConversationId: insertedIds[0],
    conversations: conversations ?? [],
  });
}

