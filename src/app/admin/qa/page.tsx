import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ClipboardList } from "lucide-react";
import { AdminShell } from "@/components/admin-layout";
import { Badge } from "@/components/ui/badge";
import { isAdminUser } from "@/lib/admin-auth";
import { qaSampleGroups } from "@/lib/admin-demo";
import { isPreviewMode } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

async function createQaSample(formData: FormData) {
  "use server";
  const question = String(formData.get("question") ?? "").trim();
  const category = String(formData.get("category") ?? "未分类").trim();
  if (question.length < 2) return;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=%2Fadmin%2Fqa");
  if (!isAdminUser(user)) redirect("/");
  await supabase.from("qa_samples").insert({ question, category, status: "draft", owner_id: user.id });
  revalidatePath("/admin/qa");
}

export default async function AdminQaPage({ searchParams }: { searchParams: Promise<{ preview?: string }> }) {
  const { preview } = await searchParams;
  const previewMode = isPreviewMode || (process.env.NODE_ENV !== "production" && preview === "1");
  const supabase = await createClient();
  const { data, error } = previewMode
    ? { data: null, error: null }
    : await supabase.from("qa_samples").select("id,question,category,status,updated_at").order("updated_at", { ascending: false }).limit(100);
  const samples = previewMode
    ? qaSampleGroups.map((group, index) => ({ id: `preview-${index}`, question: group.description, category: group.title, status: "active", updated_at: group.owner }))
    : data ?? [];

  return (
    <AdminShell previewMode={previewMode} current="qa" title="规智 · QA 样本管理" description="维护问答基线、覆盖范围与回归样本">
      <div className="grid gap-6 p-6 xl:grid-cols-[1.1fr_0.9fr]">
        <section className="rounded-[28px] border bg-white p-6 shadow-sm">
          <div className="flex items-center gap-2"><ClipboardList className="size-4 text-primary" /><p className="text-lg font-semibold">QA 样本</p><Badge className="ms-auto border-blue-200 bg-blue-50 text-blue-700">{samples.length} 条</Badge></div>
          {error ? <p className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">请先执行最新 Supabase 迁移并配置管理员角色。</p> : null}
          <div className="mt-5 space-y-3">
            {samples.map((sample) => <div key={sample.id} className="rounded-2xl border bg-slate-50 p-4"><div className="flex items-start justify-between gap-3"><p className="text-sm font-semibold leading-6 text-slate-900">{sample.question}</p><Badge className="border-slate-200 bg-white text-slate-700">{sample.status}</Badge></div><p className="mt-2 text-xs text-muted-foreground">{sample.category} · {sample.updated_at}</p></div>)}
            {samples.length === 0 && !error ? <div className="rounded-2xl border border-dashed p-8 text-center text-sm text-muted-foreground">暂无 QA 样本。</div> : null}
          </div>
        </section>
        <section className="rounded-[28px] border bg-white p-6 shadow-sm">
          <p className="text-lg font-semibold text-slate-900">新增样本</p>
          {previewMode ? <p className="mt-4 text-sm text-muted-foreground">预览模式不写入数据。</p> : <form action={createQaSample} className="mt-4 space-y-3"><textarea required minLength={2} name="question" placeholder="输入规范问题" className="min-h-28 w-full rounded-xl border p-3 text-sm" /><input required name="category" placeholder="分类，如：版本识别" className="h-10 w-full rounded-xl border px-3 text-sm" /><button type="submit" className="h-10 rounded-xl bg-primary px-4 text-sm font-medium text-white">保存为草稿</button></form>}
        </section>
      </div>
    </AdminShell>
  );
}
