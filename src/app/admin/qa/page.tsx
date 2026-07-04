import { redirect } from "next/navigation";
import { ClipboardList } from "lucide-react";
import { AdminShell } from "@/components/admin-layout";
import { Badge } from "@/components/ui/badge";
import { isPreviewMode } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import { qaSampleGroups } from "@/lib/admin-demo";

export default async function AdminQaPage({
  searchParams,
}: {
  searchParams: Promise<{ preview?: string }>;
}) {
  const { preview } = await searchParams;
  const previewMode = isPreviewMode || (process.env.NODE_ENV !== "production" && preview === "1");

  if (!previewMode) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) redirect("/login?next=%2Fadmin%2Fqa");
  }

  return (
    <AdminShell previewMode={previewMode} current="qa" title="规智 · QA 样本管理" description="维护问答样本分组、覆盖范围与责任归属">
      <div className="grid gap-6 p-6 xl:grid-cols-[1fr_0.92fr]">
        <section className="rounded-[28px] border bg-white p-6 shadow-sm">
          <div className="flex items-center gap-2">
            <ClipboardList className="size-4 text-primary" />
            <p className="text-lg font-semibold">样本分组</p>
          </div>
          <div className="mt-5 space-y-4">
            {qaSampleGroups.map((group) => (
              <div key={group.title} className="rounded-2xl border bg-slate-50 px-4 py-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-slate-900">{group.title}</p>
                  <Badge className="border-blue-200 bg-blue-50 text-blue-700">{group.count} 条</Badge>
                </div>
                <p className="mt-2 text-sm leading-6 text-slate-600">{group.description}</p>
                <p className="mt-2 text-xs text-muted-foreground">责任人：{group.owner}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="space-y-6">
          <div className="rounded-[28px] border bg-white p-6 shadow-sm">
            <p className="text-lg font-semibold text-slate-900">当前验收重点</p>
            <div className="mt-4 space-y-3 text-sm leading-6 text-slate-600">
              <div className="rounded-2xl border bg-slate-50 px-4 py-3">高频规范问题是否有稳定标准答案</div>
              <div className="rounded-2xl border bg-slate-50 px-4 py-3">复杂追问是否能补充前置条件并引用多条规范</div>
              <div className="rounded-2xl border bg-slate-50 px-4 py-3">证据不足场景是否明确拒答而不是编造结论</div>
            </div>
          </div>

          <div className="rounded-[28px] border bg-white p-6 shadow-sm">
            <p className="text-lg font-semibold text-slate-900">后续数据化方向</p>
            <div className="mt-4 grid gap-3">
              {["接入真实 QA 样本表", "支持按专业 / 风险等级筛选", "支持标记基线样本与回归样本"].map((item) => (
                <div key={item} className="rounded-2xl border border-dashed px-4 py-3 text-sm text-muted-foreground">
                  {item}
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
    </AdminShell>
  );
}

