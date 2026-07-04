import { redirect } from "next/navigation";
import { FlaskConical } from "lucide-react";
import { AdminShell } from "@/components/admin-layout";
import { Badge } from "@/components/ui/badge";
import { isPreviewMode } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import { evalSuites, qualityMetrics } from "@/lib/admin-demo";

export default async function AdminEvalsPage({
  searchParams,
}: {
  searchParams: Promise<{ preview?: string }>;
}) {
  const { preview } = await searchParams;
  const previewMode = isPreviewMode || (process.env.NODE_ENV !== "production" && preview === "1");

  if (!previewMode) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) redirect("/login?next=%2Fadmin%2Fevals");
  }

  return (
    <AdminShell previewMode={previewMode} current="evals" title="规智 · 评测系统" description="查看评测集表现、回归结果与质量指标">
      <div className="grid gap-6 p-6 xl:grid-cols-[1fr_0.88fr]">
        <section className="rounded-[28px] border bg-white p-6 shadow-sm">
          <div className="flex items-center gap-2">
            <FlaskConical className="size-4 text-primary" />
            <p className="text-lg font-semibold">评测集列表</p>
          </div>
          <div className="mt-5 space-y-4">
            {evalSuites.map((suite) => (
              <div key={suite.name} className="rounded-2xl border bg-slate-50 px-4 py-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{suite.name}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{suite.count} 道样本 · 最近回归 {suite.lastRun}</p>
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
        </section>

        <section className="space-y-6">
          <div className="rounded-[28px] border bg-white p-6 shadow-sm">
            <p className="text-lg font-semibold text-slate-900">质量指标</p>
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
              <div className="rounded-2xl border border-dashed px-4 py-3">支持手动发起回归与对比最近两次结果</div>
              <div className="rounded-2xl border border-dashed px-4 py-3">支持按模型 / 工作流版本查看评测差异</div>
              <div className="rounded-2xl border border-dashed px-4 py-3">支持失败样本直接跳转至 QA 样本详情</div>
            </div>
          </div>
        </section>
      </div>
    </AdminShell>
  );
}

