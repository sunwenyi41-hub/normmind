"use client";

import { useEffect } from "react";
import { AlertCircle, ArrowLeft, RefreshCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("app_render_failed", error);
  }, [error]);

  return (
    <main className="grid min-h-screen place-items-center bg-slate-50 px-6 py-10">
      <section className="w-full max-w-lg rounded-3xl border bg-white p-8 text-center shadow-sm">
        <div className="mx-auto grid size-14 place-items-center rounded-2xl bg-rose-50 text-rose-600">
          <AlertCircle className="size-6" />
        </div>
        <h1 className="mt-5 text-2xl font-semibold text-slate-950">页面暂时没有加载成功</h1>
        <p className="mt-3 text-sm leading-7 text-muted-foreground">
          可能是网络中断或回答流解析异常。你的账号和历史记录不会因此丢失，可以先重试当前页面。
        </p>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Button type="button" onClick={reset}>
            <RefreshCcw className="me-2 size-4" />
            重新加载
          </Button>
          <Button type="button" variant="secondary" onClick={() => window.location.assign("/")}>
            <ArrowLeft className="me-2 size-4" />
            回到工作台
          </Button>
        </div>
      </section>
    </main>
  );
}
