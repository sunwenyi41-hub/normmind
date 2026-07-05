import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, Library, Settings, ShieldCheck } from "lucide-react";
import { AccountSettingsView } from "@/components/chat-shell";
import { isAdminUser } from "@/lib/admin-auth";
import { isPreviewMode } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ preview?: string }>;
}) {
  const { preview } = await searchParams;
  const previewMode = isPreviewMode || (process.env.NODE_ENV !== "production" && preview === "1");
  let isAdmin = false;

  if (!previewMode) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) redirect("/login?next=%2Fsettings");
    isAdmin = isAdminUser(user);
  }

  return (
    <main className="min-h-screen bg-[#f4f7fb] p-4 lg:p-6">
      <div className="mx-auto max-w-7xl">
        <header className="mb-4 flex flex-wrap items-center gap-3 rounded-[28px] border bg-white px-5 py-4 shadow-sm">
          <Link className="inline-flex items-center gap-2 rounded-full bg-secondary px-3 py-1.5 text-xs font-medium text-slate-700" href={previewMode ? "/?preview=1" : "/"}>
            <ArrowLeft className="size-3.5" />
            返回工作台
          </Link>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-slate-900">规智 · 账户设置</p>
            <p className="mt-1 text-xs text-muted-foreground">查看当前登录方式状态、默认偏好与后续能力预留</p>
          </div>
          <div className="flex items-center gap-2">
            <Link className="inline-flex items-center gap-1 rounded-full bg-secondary px-3 py-1.5 text-xs font-medium text-slate-700" href={previewMode ? "/library?preview=1" : "/library"}>
              <Library className="size-3.5" />
              资料库
            </Link>
            {isAdmin ? (
              <Link className="inline-flex items-center gap-1 rounded-full bg-secondary px-3 py-1.5 text-xs font-medium text-slate-700" href="/admin">
                <ShieldCheck className="size-3.5" />
                管理后台
              </Link>
            ) : null}
            <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-3 py-1.5 text-xs font-medium text-primary">
              <Settings className="size-3.5" />
              设置
            </span>
          </div>
        </header>

        <div className="rounded-[28px] border bg-[#fcfdff] shadow-[0_40px_120px_-52px_rgba(15,23,42,0.35)]">
          <AccountSettingsView previewMode={previewMode} />
        </div>
      </div>
    </main>
  );
}
