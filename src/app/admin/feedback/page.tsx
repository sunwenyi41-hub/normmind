import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { MessageSquareWarning } from "lucide-react";
import { AdminShell } from "@/components/admin-layout";
import { Badge } from "@/components/ui/badge";
import { isAdminUser } from "@/lib/admin-auth";
import { feedbackItems } from "@/lib/admin-demo";
import { isPreviewMode } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

type FeedbackStatus = "pending" | "in_progress" | "resolved" | "closed";

const statusLabels: Record<FeedbackStatus, string> = {
  pending: "待处理",
  in_progress: "处理中",
  resolved: "已解决",
  closed: "已关闭",
};

async function updateFeedbackStatus(formData: FormData) {
  "use server";
  const id = String(formData.get("id") ?? "");
  const status = String(formData.get("status") ?? "") as FeedbackStatus;
  if (!id || !(status in statusLabels)) return;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=%2Fadmin%2Ffeedback");
  if (!isAdminUser(user)) redirect("/");

  await supabase
    .from("feedback")
    .update({
      status,
      assignee_id: user.id,
      resolved_at: status === "resolved" || status === "closed" ? new Date().toISOString() : null,
    })
    .eq("id", id);
  revalidatePath("/admin/feedback");
}

export default async function AdminFeedbackPage({ searchParams }: { searchParams: Promise<{ preview?: string }> }) {
  const { preview } = await searchParams;
  const previewMode = isPreviewMode || (process.env.NODE_ENV !== "production" && preview === "1");
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!previewMode && !user) redirect("/login?next=%2Fadmin%2Ffeedback");

  const { data, error } = previewMode
    ? { data: null, error: null }
    : await supabase
        .from("feedback")
        .select("id,rating,reason,status,created_at,conversation_id,answer_id")
        .order("created_at", { ascending: false })
        .limit(100);

  const items = previewMode
    ? feedbackItems.map((item, index) => ({ id: `preview-${index}`, rating: "unhelpful", reason: item.title, status: index === 2 ? "in_progress" : "pending", created_at: item.time, preview: true }))
    : (data ?? []).map((item) => ({ ...item, preview: false }));

  return (
    <AdminShell previewMode={previewMode} current="feedback" title="规智 · 用户反馈与问题工单" description="查看真实回答评价并跟踪处理状态">
      <div className="grid gap-6 p-6 xl:grid-cols-[1.2fr_0.8fr]">
        <section className="rounded-[28px] border bg-white p-6 shadow-sm">
          <div className="flex items-center gap-2">
            <MessageSquareWarning className="size-4 text-primary" />
            <p className="text-lg font-semibold">反馈列表</p>
            <Badge className="ms-auto border-blue-200 bg-blue-50 text-blue-700">{items.length} 条</Badge>
          </div>
          {error ? <p className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">反馈数据尚未可用，请先执行最新 Supabase 迁移并确认管理员角色。</p> : null}
          <div className="mt-5 space-y-4">
            {items.length === 0 && !error ? <div className="rounded-2xl border border-dashed p-8 text-center text-sm text-muted-foreground">暂无用户反馈。</div> : null}
            {items.map((item) => {
              const status = (item.status ?? "pending") as FeedbackStatus;
              return (
                <div key={item.id} className="rounded-2xl border bg-slate-50 px-4 py-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-slate-900">{item.rating === "helpful" ? "用户认为有帮助" : "用户认为无帮助"}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{item.reason || "未填写原因"}</p>
                      <p className="mt-2 text-[11px] text-muted-foreground">{item.created_at}</p>
                    </div>
                    <Badge className={status === "resolved" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-amber-200 bg-amber-50 text-amber-700"}>{statusLabels[status]}</Badge>
                  </div>
                  {!item.preview ? (
                    <form action={updateFeedbackStatus} className="mt-3 flex items-center gap-2">
                      <input name="id" type="hidden" value={item.id} />
                      <select name="status" defaultValue={status} className="h-9 rounded-lg border bg-white px-3 text-xs">
                        {Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                      </select>
                      <button className="h-9 rounded-lg bg-primary px-3 text-xs font-medium text-white" type="submit">更新状态</button>
                    </form>
                  ) : null}
                </div>
              );
            })}
          </div>
        </section>
        <section className="rounded-[28px] border bg-white p-6 shadow-sm">
          <p className="text-lg font-semibold text-slate-900">处理流程</p>
          <div className="mt-4 space-y-3 text-sm leading-6 text-slate-600">
            <div className="rounded-2xl border bg-slate-50 px-4 py-3">1. 确认是答案、知识库还是性能问题</div>
            <div className="rounded-2xl border bg-slate-50 px-4 py-3">2. 处理中记录责任方与改进方案</div>
            <div className="rounded-2xl border bg-slate-50 px-4 py-3">3. 解决后补入 QA 样本并运行回归</div>
          </div>
        </section>
      </div>
    </AdminShell>
  );
}
