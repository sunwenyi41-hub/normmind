import { redirect } from "next/navigation";
import { AuthForm } from "@/components/auth-form";
import { isPreviewMode } from "@/lib/env";
import { getSafeRedirectPath } from "@/lib/redirect";
import { createClient } from "@/lib/supabase/server";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ preview?: string; error?: string; next?: string }>;
}) {
  const { preview, error, next } = await searchParams;
  if (process.env.NODE_ENV !== "production" && preview === "1") {
    return <AuthForm initialMessage={resolveAuthMessage(error)} redirectTo={getSafeRedirectPath(next)} />;
  }
  if (isPreviewMode) redirect("/");
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (user) redirect(getSafeRedirectPath(next));
  return <AuthForm initialMessage={resolveAuthMessage(error)} redirectTo={getSafeRedirectPath(next)} />;
}

function resolveAuthMessage(error?: string) {
  switch (error) {
    case "oauth":
      return "第三方登录未完成，请重试或改用邮箱/手机登录。";
    case "confirm":
      return "邮箱确认链接已失效或已被使用，请重新发起注册或找回流程。";
    default:
      return null;
  }
}
