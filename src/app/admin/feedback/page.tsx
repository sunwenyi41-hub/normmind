import { redirect } from "next/navigation";
import { MessageSquareWarning } from "lucide-react";
import { AdminShell } from "@/components/admin-layout";
import { Badge } from "@/components/ui/badge";
import { isPreviewMode } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import { feedbackItems } from "@/lib/admin-demo";

export default async function AdminFeedbackPage({
  searchParams,
}: {
  searchParams: Promise<{ preview?: string }>;
}) {
  const { preview } = await searchParams;
  const previewMode = isPreviewMode || (process.env.NODE_ENV !== "production" && preview === "1");

  if (!previewMode) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) redirect("/login?next=%2Fadmin%2Ffeedback");
  }

  return (
    <AdminShell previewMode={previewMode} current="feedback" title="规智 · 用户反馈与问题工单" description="查看问题来源、优先级与处理状态">
      <div className="grid gap-6 p-6 xl:grid-cols-[1fr_0.86fr]">
        <section className="rounded-[28px] border bg-white p-6 shadow-sm">
          <div className="flex items-center gap-2">
            <MessageSquareWarning className="size-4 text-primary" />
            <p className="text-lg font-semibold">反馈列表</p>
          </div>
          <div className="mt-5 space-y-4">
            {feedbackItems.map((item) => (
              <div key={item.title} className="rounded-2xl border bg-slate-50 px-4 py-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{item.title}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{item.source} · {item.time}</p>
                  </div>
                  <Badge className={item.severity === "高" ? "border-rose-200 bg-rose-50 text-rose-700" : "border-amber-200 bg-amber-50 text-amber-700"}>
                    {item.severity}优先级
                  </Badge>
                </div>
                <div className="mt-3 text-xs text-muted-foreground">状态：{item.status}</div>
              </div>
            ))}
          </div>
        </section>

        <section className="space-y-6">
          <div className="rounded-[28px] border bg-white p-6 shadow-sm">
            <p className="text-lg font-semibold text-slate-900">处理流程建议</p>
            <div className="mt-4 space-y-3 text-sm leading-6 text-slate-600">
              <div className="rounded-2xl border bg-slate-50 px-4 py-3">1. 判断是答案质量问题、知识库问题还是性能问题</div>
              <div className="rounded-2xl border bg-slate-50 px-4 py-3">2. 标记责任方：产品 / 知识工程 / Agent / 运维</div>
              <div className="rounded-2xl border bg-slate-50 px-4 py-3">3. 关联评测回归，避免同类问题再次上线</div>
            </div>
          </div>

          <div className="rounded-[28px] border bg-white p-6 shadow-sm">
            <p className="text-lg font-semibold text-slate-900">后续接入建议</p>
            <div className="mt-4 space-y-3 text-sm text-muted-foreground">
              <div className="rounded-2xl border border-dashed px-4 py-3">接入真实 feedback 表与用户会话链接</div>
              <div className="rounded-2xl border border-dashed px-4 py-3">支持工单状态流转与处理人指派</div>
              <div className="rounded-2xl border border-dashed px-4 py-3">支持按问题来源、优先级、状态筛选</div>
            </div>
          </div>
        </section>
      </div>
    </AdminShell>
  );
}

