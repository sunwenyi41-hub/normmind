import { NextResponse } from "next/server";
import { isPreviewMode } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

export async function safeGetUser(supabase: SupabaseServerClient) {
  try {
    const { data, error } = await supabase.auth.getUser();
    if (error) {
      console.warn("supabase_get_user_failed", {
        message: error.message,
      });
      return null;
    }
    return data.user;
  } catch (error) {
    console.error("supabase_get_user_unreachable", {
      message: error instanceof Error ? error.message : String(error),
      cause: error instanceof Error && "cause" in error ? error.cause : undefined,
    });
    return null;
  }
}

export async function requireUser() {
  if (isPreviewMode) return { id: "preview-user" };
  const supabase = await createClient();
  return safeGetUser(supabase);
}

export function unauthorized() {
  return NextResponse.json({ error: "请先登录后再继续" }, { status: 401 });
}
