import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, ExternalLink, FileText, Library, Settings, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { isPreviewMode } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import { getStandardLibraryDocumentById } from "@/lib/standard-documents";

export default async function LibraryDocumentPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ preview?: string }>;
}) {
  const [{ id }, { preview }] = await Promise.all([params, searchParams]);
  const previewMode = isPreviewMode || (process.env.NODE_ENV !== "production" && preview === "1");

  if (!previewMode) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) redirect(`/login?next=${encodeURIComponent(`/library/${id}`)}`);
  }

  const document = getStandardLibraryDocumentById(id);
  if (!document) notFound();

  return (
    <main className="min-h-screen bg-[#f4f7fb] p-4 lg:p-6">
      <div className="mx-auto max-w-6xl">
        <header className="mb-4 flex flex-wrap items-center gap-3 rounded-[28px] border bg-white px-5 py-4 shadow-sm">
          <Link
            className="inline-flex items-center gap-2 rounded-full bg-secondary px-3 py-1.5 text-xs font-medium text-slate-700"
            href={previewMode ? "/library?preview=1" : "/library"}
          >
            <ArrowLeft className="size-3.5" />
            返回资料库
          </Link>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-slate-900">规智 · 规范资料详情</p>
            <p className="mt-1 text-xs text-muted-foreground">查看资料版本、标签、摘要与原文入口</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-3 py-1.5 text-xs font-medium text-primary">
              <Library className="size-3.5" />
              资料详情
            </span>
            <Link
              className="inline-flex items-center gap-1 rounded-full bg-secondary px-3 py-1.5 text-xs font-medium text-slate-700"
              href={previewMode ? "/settings?preview=1" : "/settings"}
            >
              <Settings className="size-3.5" />
              账户设置
            </Link>
            <Link
              className="inline-flex items-center gap-1 rounded-full bg-secondary px-3 py-1.5 text-xs font-medium text-slate-700"
              href={previewMode ? "/admin?preview=1" : "/admin"}
            >
              <ShieldCheck className="size-3.5" />
              管理后台
            </Link>
          </div>
        </header>

        <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
          <section className="rounded-[28px] border bg-white p-6 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-2xl font-semibold text-slate-900">{document.title}</p>
                <p className="mt-2 text-sm text-muted-foreground">{document.code}</p>
              </div>
              <Badge className="border-blue-200 bg-blue-50 text-blue-700">{document.category}</Badge>
            </div>

            <p className="mt-6 text-sm leading-7 text-slate-600">{document.summary}</p>

            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <DetailStat label="版本" value={document.version} />
              <DetailStat label="状态" value={document.status} />
              <DetailStat label="更新时间" value={document.updatedAt} />
              <DetailStat label="知识片段" value={`${document.chunks}`} />
            </div>

            <div className="mt-6">
              <p className="text-xs font-medium text-muted-foreground">业务标签</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {document.tags.map((tag) => (
                  <Badge key={tag} className="border-slate-200 bg-slate-50 text-slate-700">{tag}</Badge>
                ))}
              </div>
            </div>

            <div className="mt-8 flex flex-wrap gap-3">
              <a
                className="inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium text-primary hover:bg-blue-50"
                href={document.sourceUrl}
                rel="noreferrer"
                target="_blank"
              >
                <ExternalLink className="size-4" />
                打开原文 PDF
              </a>
              <Button variant="outline">设为推荐范围</Button>
            </div>
          </section>

          <aside className="space-y-6">
            <section className="rounded-[28px] border bg-white p-6 shadow-sm">
              <div className="flex items-center gap-2">
                <FileText className="size-4 text-primary" />
                <p className="text-lg font-semibold">资料说明</p>
              </div>
              <div className="mt-4 space-y-3 text-sm leading-7 text-slate-600">
                <p>这份资料已经具备独立详情页，可作为后续规范资料库路由结构的基础。</p>
                <p>当前详情页展示版本、状态、标签、摘要与 PDF 原文入口，后续可继续补：</p>
                <ul className="list-disc ps-5 text-muted-foreground">
                  <li>知识片段预览</li>
                  <li>最近引用记录</li>
                  <li>版本变更历史</li>
                  <li>企业库权限说明</li>
                </ul>
              </div>
            </section>

            <section className="rounded-[28px] border bg-white p-6 shadow-sm">
              <p className="text-lg font-semibold text-slate-900">后续接入建议</p>
              <div className="mt-4 grid gap-3">
                {[
                  "将详情页与真实 Supabase / Storage 文档记录打通",
                  "补充文档引用次数、最近问答命中次数等运营字段",
                  "接入版本差异对比与替代规范提示",
                ].map((item) => (
                  <div key={item} className="rounded-2xl border bg-slate-50 px-4 py-3 text-sm text-slate-600">
                    {item}
                  </div>
                ))}
              </div>
            </section>
          </aside>
        </div>
      </div>
    </main>
  );
}

function DetailStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border bg-slate-50 px-4 py-3">
      <p className="text-[11px] font-medium text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-semibold text-slate-900">{value}</p>
    </div>
  );
}
