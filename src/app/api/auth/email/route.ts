import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const authEmailSchema = z.object({
  action: z.enum(["sign-in", "sign-up", "reset-password"]),
  email: z.string().email(),
  password: z.string().min(8).optional(),
  redirectTo: z.string().default("/"),
});

function safeRedirectPath(value: string) {
  if (!value.startsWith("/")) return "/";
  if (value.startsWith("//")) return "/";
  return value;
}

function jsonResponse(body: unknown, init?: ResponseInit) {
  const response = NextResponse.json(body, init);
  response.headers.set("cache-control", "private, no-store");
  return response;
}

function authServiceUnavailable(error: unknown) {
  console.error("supabase_auth_service_unreachable", {
    message: error instanceof Error ? error.message : String(error),
    cause: error instanceof Error && "cause" in error ? error.cause : undefined,
  });
  return jsonResponse(
    {
      error: "认证服务暂时连接失败。请确认 Supabase 项目未暂停、Project URL 正确，或稍后重试。",
    },
    { status: 503 },
  );
}

export async function POST(request: NextRequest) {
  const parsed = authEmailSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return jsonResponse({ error: "登录请求格式不正确" }, { status: 400 });
  }

  const { action, email, password } = parsed.data;
  const redirectTo = safeRedirectPath(parsed.data.redirectTo);
  const origin = request.nextUrl.origin;
  const supabase = await createClient();

  if ((action === "sign-in" || action === "sign-up") && !password) {
    return jsonResponse({ error: "请输入至少 8 位密码" }, { status: 400 });
  }

  if (action === "sign-in") {
    let error;
    try {
      ({ error } = await supabase.auth.signInWithPassword({
        email,
        password: password as string,
      }));
    } catch (caught) {
      return authServiceUnavailable(caught);
    }

    if (error) return jsonResponse({ error: error.message }, { status: 401 });
    return jsonResponse({ ok: true, redirectTo });
  }

  if (action === "sign-up") {
    let data;
    let error;
    try {
      ({ data, error } = await supabase.auth.signUp({
        email,
        password: password as string,
        options: {
          emailRedirectTo: `${origin}/auth/confirm?next=${encodeURIComponent(redirectTo)}`,
        },
      }));
    } catch (caught) {
      return authServiceUnavailable(caught);
    }

    if (error) return jsonResponse({ error: error.message }, { status: 400 });
    return jsonResponse({
      ok: true,
      hasSession: Boolean(data.session),
      message: data.session
        ? "注册成功，已自动登录。"
        : "注册成功，请前往邮箱完成验证，再使用新账号登录。",
      redirectTo,
    });
  }

  let error;
  try {
    ({ error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${origin}/auth/callback?next=${encodeURIComponent("/reset-password")}`,
    }));
  } catch (caught) {
    return authServiceUnavailable(caught);
  }

  if (error) return jsonResponse({ error: error.message }, { status: 400 });
  return jsonResponse({
    ok: true,
    message: "如果该邮箱已注册，重置密码邮件将很快发送，请检查收件箱和垃圾邮件。",
  });
}
