import { FlaskConical } from "lucide-react";
import { AdminShell } from "@/components/admin-layout";
import { Badge } from "@/components/ui/badge";
import { evalSuites, qualityMetrics } from "@/lib/admin-demo";
import { isPreviewMode } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

export default async function AdminEvalsPage({ searchParams }: { searchParams: Promise<{ preview?: string }> }) {
  const { preview } = await searchParams;
  const previewMode = isPreviewMode || (process.env.NODE_ENV !== "production" && preview === "1");
  const supabase = await createClient();
  const { data, error } = previewMode
    ? { data: null, error: null }
    : await supabase.from("evaluation_runs").select("id,name,status,total_count,passed_count,failed_items,created_at").order("created_at", { ascending: false }).limit(50);
  const runs = previewMode
    ? evalSuites.map((suite, index) => ({ id: `preview-${index}`, name: suite.name, status: suite.status === "已达标" ? "completed" : "failed", total_count: suite.count, passed_count: Math.round(suite.count * Number.parseInt(suite.score, 10) / 100), created_at: suite.lastRun }))
    : data ?? [];

  return (
    <AdminShell previewMode={previewMode} current="evals" title="规智 · 评测系统" description="查看真实回归记录、通过率与失败项">
      <div className="grid gap-6 p-6 xl:grid-cols-[1fr_0.88fr]">
        <section className="rounded-[28px] border bg-white p-6 shadow-sm">
          <div className="flex items-center gap-2"><FlaskConical className="size-4 text-primary" /><p className="text-lg font-semibold">评测记录</p></div>
          {error ? <p className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">请先执行最新 Supabase 迁移并配置管理员角色。</p> : null}
          <div className="mt-5 space-y-4">
            {runs.map((run) => { const score = run.total_count > 0 ? Math.round(run.passed_count / run.total_count * 100) : 0; return <div key={run.id} className="rounded-2xl border bg-slate-50 p-4"><div className="flex items-start justify-between gap-3"><div><p className="text-sm font-semibold text-slate-900">{run.name}</p><p className="mt-1 text-xs text-muted-foreground">{run.total_count} 道样本 · {run.created_at}</p></div><Badge className={run.status === "completed" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-rose-200 bg-rose-50 text-rose-700"}>{run.status}</Badge></div><div className="mt-3 flex items-center justify-between text-xs"><span className="text-muted-foreground">通过率</span><span className="font-semibold text-slate-800">{score}%</span></div></div>; })}
            {runs.length === 0 && !error ? <div className="rounded-2xl border border-dashed p-8 text-center text-sm text-muted-foreground">暂无评测记录。</div> : null}
          </div>
        </section>
        <section className="rounded-[28px] border bg-white p-6 shadow-sm"><p className="text-lg font-semibold text-slate-900">质量指标</p><div className="mt-4 grid gap-3 sm:grid-cols-2">{qualityMetrics.map((metric) => <div key={metric.label} className="rounded-2xl border bg-slate-50 px-4 py-3"><p className="text-[11px] text-muted-foreground">{metric.label}</p><p className="mt-1 text-sm font-semibold">{metric.value}</p></div>)}</div><p className="mt-5 text-xs leading-5 text-muted-foreground">工作流自动执行将在下一版接入；当前可完整保存和查看评测结果。</p></section>
      </div>
    </AdminShell>
  );
}
