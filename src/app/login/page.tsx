import { redirect } from "next/navigation";
import { AuthForm } from "@/components/auth-form";
import { safeGetUser } from "@/lib/auth";
import { isPreviewMode } from "@/lib/env";
import { getSafeRedirectPath } from "@/lib/redirect";
import { createClient } from "@/lib/supabase/server";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ preview?: string; error?: string; next?: string; reset?: string }>;
}) {
  const { preview, error, next, reset } = await searchParams;
  const initialMessage = reset === "success"
    ? "密码已更新，请使用新密码登录。"
    : resolveAuthMessage(error);
  if (process.env.NODE_ENV !== "production" && preview === "1") {
    return <AuthForm initialMessage={initialMessage} redirectTo={getSafeRedirectPath(next)} />;
  }
  if (isPreviewMode) redirect("/");
  const supabase = await createClient();
  const user = await safeGetUser(supabase);
  if (user) redirect(getSafeRedirectPath(next));
  return <AuthForm initialMessage={initialMessage} redirectTo={getSafeRedirectPath(next)} />;
}

function resolveAuthMessage(error?: string) {
  switch (error) {
    case "oauth":
      return "第三方登录未完成，请重试或改用邮箱/手机登录。";
    case "confirm":
      return "邮箱确认链接已失效或已被使用，请重新发起注册或找回流程。";
    case "recovery":
      return "密码重置链接已失效或恢复会话不存在，请重新发送重置邮件。";
    default:
      return null;
  }
}
