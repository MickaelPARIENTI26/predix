import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getEnv } from "@/lib/env";

// Paths that require an authenticated user. Extend as the app grows
// (competitions, predictions, admin…). Route groups like (app) don't appear
// in the URL, so protection is by real path prefix.
const PROTECTED_PREFIXES = ["/profile"];
// Auth pages a logged-in user shouldn't see.
const AUTH_PATHS = ["/login", "/signup"];

/**
 * Refreshes the Supabase session cookie on every request (the core job of
 * @supabase/ssr) and enforces coarse route protection. Do NOT insert logic
 * between createServerClient and getUser, and always return the response whose
 * cookies the client set — otherwise sessions silently break.
 */
export async function updateSession(
  request: NextRequest
): Promise<NextResponse> {
  let response = NextResponse.next({ request });
  const env = getEnv();

  const supabase = createServerClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  if (!user && PROTECTED_PREFIXES.some((p) => pathname.startsWith(p))) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return redirectPreservingCookies(url, response);
  }

  if (user && AUTH_PATHS.includes(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = "/profile";
    url.search = "";
    return redirectPreservingCookies(url, response);
  }

  return response;
}

// A redirect must carry the session cookies that getUser() may have rotated
// onto `response`, or the browser keeps a stale token and silently logs out.
function redirectPreservingCookies(
  url: URL,
  response: NextResponse
): NextResponse {
  const redirectResponse = NextResponse.redirect(url);
  response.cookies.getAll().forEach((cookie) => {
    redirectResponse.cookies.set(cookie);
  });
  return redirectResponse;
}
