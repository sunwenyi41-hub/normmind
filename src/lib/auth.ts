import { NextResponse } from "next/server";
import { isPreviewMode } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

export async function requireUser() {
  if (isPreviewMode) return { id: "preview-user" };
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;
  return data.user;
}

export function unauthorized() {
  return NextResponse.json({ error: "请先登录后再继续" }, { status: 401 });
}
