import { redirect } from "next/navigation";
import { AuthForm } from "@/components/auth-form";
import { isPreviewMode } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ preview?: string }>;
}) {
  const { preview } = await searchParams;
  if (process.env.NODE_ENV !== "production" && preview === "1") {
    return <AuthForm />;
  }
  if (isPreviewMode) redirect("/");
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (user) redirect("/");
  return <AuthForm />;
}
