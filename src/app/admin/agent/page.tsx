import { redirect } from "next/navigation";
import { Bot } from "lucide-react";
import { AdminShell } from "@/components/admin-layout";
import { Badge } from "@/components/ui/badge";
import { isPreviewMode } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import { agentConfigs, qualityMetrics } from "@/lib/admin-demo";

export default async function AdminAgentPage({
  searchParams,
}: {
  searchParams: Promise<{ preview?: string }>;
}) {
  const { preview } = await searchParams;
  const previewMode = isPreviewMode || (process.env.NODE_ENV !== "production" && preview === "1");

  if (!previewMode) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) redirect("/login?next=%2Fadmin%2Fagent");
  }

  return (
    <AdminShell previewMode={previewMode} current="agent" title="规智 · Agent 配置" description="查看工作流接入状态、审计位与质量指标">
      <div className="grid gap-6 p-6 xl:grid-cols-[1fr_0.86fr]">
        <section className="rounded-[28px] border bg-white p-6 shadow-sm">
          <div className="flex items-center gap-2">
            <Bot className="size-4 text-primary" />
            <p className="text-lg font-semibold">工作流配置</p>
          </div>
          <div className="mt-5 space-y-4">
            {agentConfigs.map((item) => (
              <div key={item.title} className="rounded-2xl border bg-slate-50 px-4 py-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{item.title}</p>
                    <p className="mt-2 text-sm leading-6 text-slate-600">{item.description}</p>
                  </div>
                  <Badge className={item.status === "已接入" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-amber-200 bg-amber-50 text-amber-700"}>
                    {item.status}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="space-y-6">
          <div className="rounded-[28px] border bg-white p-6 shadow-sm">
            <p className="text-lg font-semibold text-slate-900">质量监控</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {qualityMetrics.map((metric) => (
                <div key={metric.label} className="rounded-2xl border bg-slate-50 px-4 py-3">
                  <p className="text-[11px] font-medium text-muted-foreground">{metric.label}</p>
                  <p className="mt-1 text-sm font-semibold text-slate-900">{metric.value}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[28px] border bg-white p-6 shadow-sm">
            <p className="text-lg font-semibold text-slate-900">后续接入建议</p>
            <div className="mt-4 space-y-3 text-sm text-muted-foreground">
              <div className="rounded-2xl border border-dashed px-4 py-3">接入真实 Coze Workflow / Bot 元数据与 trace 统计</div>
              <div className="rounded-2xl border border-dashed px-4 py-3">接入 RAG 召回对比、重排差异和版本缺失率趋势</div>
              <div className="rounded-2xl border border-dashed px-4 py-3">支持切换当前生效的普通 / 深度模式工作流 ID</div>
            </div>
          </div>
        </section>
      </div>
    </AdminShell>
  );
}

