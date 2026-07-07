import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSafeRedirectPath } from "@/lib/redirect";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const requestedNext = request.nextUrl.searchParams.get("next");
  const next = getSafeRedirectPath(request.nextUrl.searchParams.get("next"));
  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      const destination = !requestedNext && isRecentRecovery(data.user?.recovery_sent_at)
        ? "/reset-password"
        : next;
      return noStoreRedirect(new URL(destination, request.url));
    }
  }
  return noStoreRedirect(
    new URL(`/login?error=oauth&next=${encodeURIComponent(next)}`, request.url),
  );
}

function isRecentRecovery(recoverySentAt?: string) {
  if (!recoverySentAt) return false;
  const sentAt = Date.parse(recoverySentAt);
  return Number.isFinite(sentAt) && Date.now() - sentAt < 60 * 60 * 1000;
}

function noStoreRedirect(url: URL) {
  const response = NextResponse.redirect(url);
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}
