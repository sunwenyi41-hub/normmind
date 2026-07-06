"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  CheckCircle2,
  Loader2,
  LockKeyhole,
  Mail,
  MessageCircle,
  Phone,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";

type LoginMethod = "email" | "phone";
type CapabilityStatus = "available" | "coming_soon";

const phoneAuthStatus: CapabilityStatus =
  process.env.NEXT_PUBLIC_PHONE_AUTH_ENABLED === "1" ? "available" : "coming_soon";
const wechatAuthStatus: CapabilityStatus = "coming_soon";

function normalizeChinesePhone(value: string) {
  const compact = value.replace(/[\s-]/g, "");
  return /^1\d{10}$/.test(compact) ? `+86${compact}` : compact;
}

function formatAuthError(error: unknown) {
  const fallback = "操作失败，请稍后重试。";
  if (!(error instanceof Error)) return fallback;

  const message = error.message.toLowerCase();
  if (message.includes("email rate limit exceeded") || message.includes("over_email_send_rate_limit")) {
    return "注册邮件发送过于频繁，已触发邮件服务限制。请稍后再试，或联系管理员配置正式 SMTP 邮件服务。";
  }
  if (message.includes("email address not authorized")) {
    return "当前邮箱未被 Supabase 默认邮件服务授权。请配置正式 SMTP 后再注册。";
  }
  if (message.includes("user already registered")) {
    return "该邮箱已注册，请直接登录。";
  }
  if (message.includes("invalid login credentials")) {
    return "邮箱或密码不正确。";
  }
  if (message.includes("password") && message.includes("characters")) {
    return "密码强度不足，请使用至少 8 位密码。";
  }
  if (message.includes("sms") && message.includes("provider")) {
    return "短信服务商尚未配置，请联系管理员完成 Supabase Phone Auth 配置。";
  }
  if (message.includes("sms") && message.includes("rate")) {
    return "短信验证码请求过于频繁，请至少等待 60 秒后再试。";
  }

  return error.message || fallback;
}

export function AuthForm({
  initialMessage = null,
  redirectTo = "/",
}: {
  initialMessage?: string | null;
  redirectTo?: string;
}) {
  const router = useRouter();
  const [method, setMethod] = useState<LoginMethod>("email");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(initialMessage);

  function selectMethod(nextMethod: LoginMethod) {
    if (nextMethod === "phone" && phoneAuthStatus !== "available") {
      setMessage("手机号登录正在配置短信服务，当前版本暂未开放。");
      return;
    }
    setMethod(nextMethod);
    setMessage(null);
    setOtpSent(false);
    setOtp("");
  }

  async function submitEmail(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setMessage(null);
    try {
      const supabase = createClient();
      if (isSignUp) {
        await supabase.auth.signOut({ scope: "local" });
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/auth/confirm?next=${encodeURIComponent(redirectTo)}`,
          },
        });
        if (error) throw error;
        if (data.session) {
          router.push(redirectTo);
          router.refresh();
        } else {
          setMessage("注册成功，请前往邮箱完成验证，再使用新账号登录。");
        }
      } else {
        await supabase.auth.signOut({ scope: "local" });
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        router.push(redirectTo);
        router.refresh();
      }
    } catch (error) {
      setMessage(formatAuthError(error));
    } finally {
      setLoading(false);
    }
  }

  async function submitPhone(event: React.FormEvent) {
    event.preventDefault();
    if (phoneAuthStatus !== "available") {
      setMessage("手机号登录正在配置短信服务，当前版本暂未开放。");
      return;
    }
    setLoading(true);
    setMessage(null);
    const normalizedPhone = normalizeChinesePhone(phone);
    try {
      const supabase = createClient();
      if (!otpSent) {
        await supabase.auth.signOut({ scope: "local" });
        const { error } = await supabase.auth.signInWithOtp({
          phone: normalizedPhone,
          options: { shouldCreateUser: true },
        });
        if (error) throw error;
        setOtpSent(true);
        setMessage("6 位验证码已发送，默认 60 秒后可重新获取。");
      } else {
        const { error } = await supabase.auth.verifyOtp({
          phone: normalizedPhone,
          token: otp,
          type: "sms",
        });
        if (error) throw error;
        router.push(redirectTo);
        router.refresh();
      }
    } catch (error) {
      setMessage(formatAuthError(error));
    } finally {
      setLoading(false);
    }
  }

  async function signInWithWeChat() {
    if (wechatAuthStatus !== "available") {
      setMessage("微信登录正在配置企业微信 / OAuth 回调，当前版本暂未开放。");
      return;
    }
    setLoading(true);
    setMessage(null);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "custom:wechat",
        options: {
          redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(redirectTo)}`,
        },
      });
      if (error) throw error;
    } catch (error) {
      setMessage(formatAuthError(error));
      setLoading(false);
    }
  }

  return (
    <main className="grid min-h-screen lg:grid-cols-[1.1fr_0.9fr]">
      <section className="relative hidden overflow-hidden bg-[#102840] p-14 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="absolute inset-0 opacity-20 [background-image:linear-gradient(rgba(255,255,255,.08)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.08)_1px,transparent_1px)] [background-size:48px_48px]" />
        <div className="relative flex items-center gap-3 text-lg font-semibold">
          <span className="grid size-10 place-items-center rounded-xl bg-white/10">
            <Building2 className="size-5" />
          </span>
          规智 NormMind
        </div>
        <div className="relative max-w-xl">
          <p className="mb-4 text-sm font-medium tracking-[0.2em] text-blue-200">
            建筑景观规范智能助手
          </p>
          <h1 className="text-5xl font-semibold leading-tight tracking-tight">
            每一个结论，
            <br />
            都能回到规范原文。
          </h1>
          <div className="mt-10 grid gap-4 text-sm text-blue-100/85">
            {[
              "权威规范知识库，清晰标注版本与条款",
              "快速问答与深度检索，覆盖复杂多跳问题",
              "引用可追溯，降低规范遗漏与误读风险",
            ].map((item) => (
              <div key={item} className="flex items-center gap-3">
                <CheckCircle2 className="size-4 text-blue-300" />
                {item}
              </div>
            ))}
          </div>
        </div>
        <p className="relative text-xs text-blue-200/60">
          AI 结果仅供辅助参考，重要结论请由专业人员复核。
        </p>
      </section>

      <section className="flex items-center justify-center p-6 sm:p-12">
        <Card className="w-full max-w-md border-0 shadow-none sm:border sm:shadow-sm">
          <CardHeader className="space-y-2 pb-4">
            <div className="mb-5 grid size-11 place-items-center rounded-xl bg-primary text-primary-foreground lg:hidden">
              <Building2 className="size-5" />
            </div>
            <CardTitle className="text-2xl">
              {isSignUp ? "创建账号" : "欢迎使用规智"}
            </CardTitle>
            <CardDescription>
              {isSignUp
                ? "注册后即可保存查询记录与反馈"
                : "登录后继续你的规范检索工作"}
            </CardDescription>
          </CardHeader>

          <CardContent>
            <div className="mb-5 grid grid-cols-2 rounded-xl bg-secondary p-1">
              <button
                type="button"
                className={cn(
                  "flex h-9 items-center justify-center gap-2 rounded-lg text-sm transition",
                  method === "email"
                    ? "bg-white font-medium text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
                onClick={() => selectMethod("email")}
              >
                <Mail className="size-4" />邮箱
              </button>
              <button
                type="button"
                className={cn(
                  "flex h-9 items-center justify-center gap-2 rounded-lg text-sm transition",
                  method === "phone"
                    ? "bg-white font-medium text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                  phoneAuthStatus !== "available" && "opacity-60",
                )}
                onClick={() => selectMethod("phone")}
              >
                <Phone className="size-4" />手机
                {phoneAuthStatus !== "available" ? <span className="text-[10px]">即将开放</span> : null}
              </button>
            </div>

            {method === "email" ? (
              <form className="space-y-4" onSubmit={submitEmail}>
                <label className="block space-y-2 text-sm font-medium">
                  邮箱
                  <div className="relative">
                    <Mail className="absolute start-3 top-3 size-4 text-muted-foreground" />
                    <Input
                      className="ps-10"
                      type="email"
                      autoComplete="email"
                      required
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      placeholder="name@company.com"
                    />
                  </div>
                </label>
                <label className="block space-y-2 text-sm font-medium">
                  密码
                  <div className="relative">
                    <LockKeyhole className="absolute start-3 top-3 size-4 text-muted-foreground" />
                    <Input
                      className="ps-10"
                      type="password"
                      autoComplete={isSignUp ? "new-password" : "current-password"}
                      minLength={8}
                      required
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      placeholder="至少 8 位"
                    />
                  </div>
                </label>
                <StatusMessage message={message} />
                <Button className="w-full" disabled={loading}>
                  {loading ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <>
                      {isSignUp ? "注册" : "登录"}
                      <ArrowRight className="size-4" />
                    </>
                  )}
                </Button>
              </form>
            ) : (
              <form className="space-y-4" onSubmit={submitPhone}>
                {phoneAuthStatus !== "available" ? (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm leading-6 text-amber-800">
                    当前仅开放邮箱登录。手机号登录会在短信服务配置完成后开放。
                  </div>
                ) : null}
                <label className="block space-y-2 text-sm font-medium">
                  手机号
                  <div className="relative">
                    <Phone className="absolute start-3 top-3 size-4 text-muted-foreground" />
                    <Input
                      className="ps-10"
                      inputMode="tel"
                      autoComplete="tel"
                      required
                      value={phone}
                      onChange={(event) => setPhone(event.target.value)}
                      placeholder="中国大陆手机号或 +国家码"
                      disabled={otpSent || phoneAuthStatus !== "available"}
                    />
                  </div>
                </label>
                {otpSent && (
                  <label className="block space-y-2 text-sm font-medium">
                    短信验证码
                    <Input
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      pattern="[0-9]{6}"
                      maxLength={6}
                      required
                      value={otp}
                      onChange={(event) =>
                        setOtp(event.target.value.replace(/\D/g, ""))
                      }
                      placeholder="输入 6 位验证码"
                      disabled={phoneAuthStatus !== "available"}
                    />
                  </label>
                )}
                <StatusMessage message={message} />
                <Button className="w-full" disabled={loading || phoneAuthStatus !== "available"}>
                  {loading ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : otpSent ? (
                    <>验证并登录<ArrowRight className="size-4" /></>
                  ) : (
                    <>获取验证码<ArrowRight className="size-4" /></>
                  )}
                </Button>
                {otpSent && (
                  <button
                    type="button"
                    className="flex w-full items-center justify-center gap-1 text-sm text-muted-foreground hover:text-foreground"
                    onClick={() => {
                      setOtpSent(false);
                      setOtp("");
                      setMessage(null);
                    }}
                  >
                    <ArrowLeft className="size-3.5" />更换手机号
                  </button>
                )}
              </form>
            )}

            {!isSignUp && (
              <>
                <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground">
                  <span className="h-px flex-1 bg-border" />其他方式登录
                  <span className="h-px flex-1 bg-border" />
                </div>
                <Button
                  type="button"
                  className="w-full border-[#07c160]/30 text-[#078c47] hover:bg-[#07c160]/5"
                  variant="outline"
                  disabled={loading}
                  onClick={signInWithWeChat}
                >
                  <MessageCircle className="size-4 fill-[#07c160] text-[#07c160]" />
                  微信登录
                  {wechatAuthStatus !== "available" ? <span className="ms-1 text-[10px] text-muted-foreground">即将开放</span> : null}
                </Button>
                {wechatAuthStatus !== "available" ? (
                  <p className="mt-2 text-xs leading-5 text-muted-foreground">
                    当前版本尚未完成微信 OAuth 配置，建议先使用邮箱登录。
                  </p>
                ) : null}
              </>
            )}

            <Button
              type="button"
              className="mt-5 w-full"
              variant="secondary"
              onClick={() => router.push("/?preview=1")}
            >
              进入工作台预览
              <ArrowRight className="size-4" />
            </Button>

            {method === "email" && (
              <button
                className="mt-5 w-full text-sm text-muted-foreground hover:text-foreground"
                onClick={() => {
                  setIsSignUp((value) => !value);
                  setMessage(null);
                }}
              >
                {isSignUp ? "已有账号？立即登录" : "还没有账号？免费注册"}
              </button>
            )}
          </CardContent>
        </Card>
      </section>
    </main>
  );
}

function StatusMessage({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p
      className="rounded-lg bg-muted px-3 py-2 text-sm leading-6 text-muted-foreground"
      role="status"
    >
      {message}
    </p>
  );
}
