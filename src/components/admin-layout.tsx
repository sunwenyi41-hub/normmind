import Link from "next/link";
import { ArrowLeft, Bot, ClipboardList, FlaskConical, Library, MessageSquareWarning, Settings, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";

type AdminSection = "overview" | "qa" | "evals" | "feedback" | "agent" | "audit";

const sections: Array<{
  key: AdminSection;
  label: string;
  href: string;
  icon: typeof ShieldCheck;
}> = [
  { key: "overview", label: "后台概览", href: "/admin", icon: ShieldCheck },
  { key: "qa", label: "QA 样本", href: "/admin/qa", icon: ClipboardList },
  { key: "evals", label: "评测系统", href: "/admin/evals", icon: FlaskConical },
  { key: "feedback", label: "反馈工单", href: "/admin/feedback", icon: MessageSquareWarning },
  { key: "agent", label: "Agent 配置", href: "/admin/agent", icon: Bot },
  { key: "audit", label: "质量审计", href: "/admin/audit", icon: ShieldCheck },
];

export function AdminShell({
  previewMode,
  current,
  title,
  description,
  children,
}: {
  previewMode: boolean;
  current: AdminSection;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  const withPreview = (href: string) => (previewMode ? `${href}?preview=1` : href);

  return (
    <main className="min-h-screen bg-[#f4f7fb] p-4 lg:p-6">
      <div className="mx-auto max-w-7xl">
        <header className="mb-4 flex flex-wrap items-center gap-3 rounded-[28px] border bg-white px-5 py-4 shadow-sm">
          <Link className="inline-flex items-center gap-2 rounded-full bg-secondary px-3 py-1.5 text-xs font-medium text-slate-700" href={withPreview("/")}>
            <ArrowLeft className="size-3.5" />
            返回工作台
          </Link>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-slate-900">{title}</p>
            <p className="mt-1 text-xs text-muted-foreground">{description}</p>
          </div>
          <div className="flex items-center gap-2">
            <Link className="inline-flex items-center gap-1 rounded-full bg-secondary px-3 py-1.5 text-xs font-medium text-slate-700" href={withPreview("/library")}>
              <Library className="size-3.5" />
              资料库
            </Link>
            <Link className="inline-flex items-center gap-1 rounded-full bg-secondary px-3 py-1.5 text-xs font-medium text-slate-700" href={withPreview("/settings")}>
              <Settings className="size-3.5" />
              账户设置
            </Link>
            <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-3 py-1.5 text-xs font-medium text-primary">
              <ShieldCheck className="size-3.5" />
              管理后台
            </span>
          </div>
        </header>

        <div className="grid gap-6 xl:grid-cols-[240px_1fr]">
          <aside className="rounded-[28px] border bg-white p-4 shadow-sm">
            <p className="px-2 pb-3 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              Admin
            </p>
            <nav className="space-y-2">
              {sections.map((section) => {
                const Icon = section.icon;
                return (
                  <Link
                    key={section.key}
                    className={cn(
                      "flex items-center gap-3 rounded-2xl px-3 py-3 text-sm transition",
                      current === section.key
                        ? "bg-blue-50 font-medium text-primary"
                        : "text-slate-600 hover:bg-slate-50 hover:text-slate-900",
                    )}
                    href={withPreview(section.href)}
                  >
                    <Icon className="size-4" />
                    {section.label}
                  </Link>
                );
              })}
            </nav>
          </aside>

          <div className="rounded-[28px] border bg-[#fcfdff] shadow-[0_40px_120px_-52px_rgba(15,23,42,0.35)]">
            {children}
          </div>
        </div>
      </div>
    </main>
  );
}
