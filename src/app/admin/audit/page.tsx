import { redirect } from "next/navigation";
import { BarChart3, ShieldCheck } from "lucide-react";
import { AdminShell } from "@/components/admin-layout";
import { Badge } from "@/components/ui/badge";
import { isPreviewMode } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import { auditItems, auditMetrics } from "@/lib/admin-demo";

export default async function AdminAuditPage({
  searchParams,
}: {
  searchParams: Promise<{ preview?: string }>;
}) {
  const { preview } = await searchParams;
  const previewMode = isPreviewMode || (process.env.NODE_ENV !== "production" && preview === "1");

  if (!previewMode) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) redirect("/login?next=%2Fadmin%2Faudit");
  }

  return (
    <AdminShell
      previewMode={previewMode}
      current="audit"
      title="规智 · RAG / 引用质量审计"
      description="查看召回、重排、引用字段完整性与页码定位质量"
    >
      <div className="grid gap-6 p-6 xl:grid-cols-[0.94fr_1.06fr]">
        <section className="rounded-[28px] border bg-white p-6 shadow-sm">
          <div className="flex items-center gap-2">
            <BarChart3 className="size-4 text-primary" />
            <p className="text-lg font-semibold">核心质量指标</p>
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {auditMetrics.map((metric) => (
              <div key={metric.label} className="rounded-2xl border bg-slate-50 px-4 py-3">
                <p className="text-[11px] font-medium text-muted-foreground">{metric.label}</p>
                <p className="mt-1 text-sm font-semibold text-slate-900">{metric.value}</p>
              </div>
            ))}
          </div>

          <div className="mt-6 rounded-2xl border bg-slate-50 px-4 py-4 text-sm leading-6 text-slate-600">
            当前为演示指标，后续可接入真实日志、trace、评测回归与知识库元数据统计。
          </div>
        </section>

        <section className="space-y-6">
          <div className="rounded-[28px] border bg-white p-6 shadow-sm">
            <div className="flex items-center gap-2">
              <ShieldCheck className="size-4 text-primary" />
              <p className="text-lg font-semibold">待审计问题项</p>
            </div>
            <div className="mt-5 space-y-4">
              {auditItems.map((item) => (
                <div key={item.title} className="rounded-2xl border bg-slate-50 px-4 py-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{item.title}</p>
                      <p className="mt-2 text-sm leading-6 text-slate-600">{item.issue}</p>
                    </div>
                    <Badge className={item.severity === "高" ? "border-rose-200 bg-rose-50 text-rose-700" : "border-amber-200 bg-amber-50 text-amber-700"}>
                      {item.severity}优先级
                    </Badge>
                  </div>
                  <div className="mt-3 rounded-xl border border-dashed px-3 py-2 text-xs leading-5 text-muted-foreground">
                    建议动作：{item.action}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[28px] border bg-white p-6 shadow-sm">
            <p className="text-lg font-semibold text-slate-900">后续接入建议</p>
            <div className="mt-4 space-y-3 text-sm text-muted-foreground">
              <div className="rounded-2xl border border-dashed px-4 py-3">按规范维度查看引用字段缺失率与版本冲突率</div>
              <div className="rounded-2xl border border-dashed px-4 py-3">按工作流版本对比召回命中率与无引用率变化</div>
              <div className="rounded-2xl border border-dashed px-4 py-3">将审计异常项直接回写到 QA 样本与反馈工单</div>
            </div>
          </div>
        </section>
      </div>
    </AdminShell>
  );
}
