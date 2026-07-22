import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function proxy(request: NextRequest) {
  if (
    request.nextUrl.pathname === "/" &&
    (request.nextUrl.searchParams.get("error_code") === "otp_expired" ||
      request.nextUrl.searchParams.get("error") === "access_denied")
  ) {
    const errorUrl = request.nextUrl.clone();
    errorUrl.pathname = "/login";
    errorUrl.search = "?error=recovery";
    const redirect = NextResponse.redirect(errorUrl);
    redirect.headers.set("Cache-Control", "private, no-store");
    return redirect;
  }

  if (request.nextUrl.pathname === "/" && request.nextUrl.searchParams.has("code")) {
    const callbackUrl = request.nextUrl.clone();
    callbackUrl.pathname = "/auth/callback";
    const redirect = NextResponse.redirect(callbackUrl);
    redirect.headers.set("Cache-Control", "private, no-store");
    return redirect;
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return NextResponse.next({ request });
  let response = NextResponse.next({ request });
  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });
  try {
    await supabase.auth.getUser();
  } catch (error) {
    console.error("proxy_supabase_session_refresh_failed", {
      message: error instanceof Error ? error.message : String(error),
    });
  }
  return response;
}

export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"] };
