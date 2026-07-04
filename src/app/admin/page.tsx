import { redirect } from "next/navigation";
import Link from "next/link";
import { Bot, ClipboardList, FlaskConical, MessageSquareWarning } from "lucide-react";
import { AdminShell } from "@/components/admin-layout";
import { AdminOpsView } from "@/components/chat-shell";
import { isPreviewMode } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ preview?: string }>;
}) {
  const { preview } = await searchParams;
  const previewMode = isPreviewMode || (process.env.NODE_ENV !== "production" && preview === "1");

  if (!previewMode) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) redirect("/login?next=%2Fadmin");
  }

  return (
    <AdminShell
      previewMode={previewMode}
      current="overview"
      title="规智 · 管理后台"
      description="最小化 QA、评测、反馈与 Agent 调优运营台"
    >
      <div>
        <div className="border-b bg-white/70 px-6 py-5">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {[
              { href: "/admin/qa", label: "QA 样本管理", icon: ClipboardList, desc: "查看样本分类与维护入口" },
              { href: "/admin/evals", label: "评测系统", icon: FlaskConical, desc: "查看评测集与最近回归结果" },
              { href: "/admin/feedback", label: "反馈工单", icon: MessageSquareWarning, desc: "查看问题来源与处理优先级" },
              { href: "/admin/agent", label: "Agent 配置", icon: Bot, desc: "查看工作流接入与审计位" },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.label}
                  className="rounded-2xl border bg-slate-50 px-4 py-4 transition hover:border-primary/30 hover:bg-blue-50/40"
                  href={previewMode ? `${item.href}?preview=1` : item.href}
                >
                  <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                    <Icon className="size-4 text-primary" />
                    {item.label}
                  </div>
                  <p className="mt-2 text-xs leading-5 text-muted-foreground">{item.desc}</p>
                </Link>
              );
            })}
          </div>
        </div>

        <div className="rounded-[28px] border-0 shadow-none">
          <AdminOpsView previewMode={previewMode} />
        </div>
      </div>
    </AdminShell>
  );
}
