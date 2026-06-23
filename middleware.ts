import { NextRequest, NextResponse } from "next/server";

// Simple shared-password gate (HTTP Basic Auth) for the whole site.
// Set DASHBOARD_PASSWORD in the environment. Any username is accepted; only
// the password is checked. If DASHBOARD_PASSWORD is unset, the site is open
// (useful for local dev) — so ALWAYS set it in production.

export function middleware(req: NextRequest) {
  const password = process.env.DASHBOARD_PASSWORD;
  if (!password) return NextResponse.next();

  const header = req.headers.get("authorization");
  if (header?.startsWith("Basic ")) {
    try {
      const decoded = atob(header.slice(6)); // "user:pass"
      const pass = decoded.slice(decoded.indexOf(":") + 1);
      if (pass === password) return NextResponse.next();
    } catch {
      /* fall through to challenge */
    }
  }

  return new NextResponse("Authentication required.", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="Instagram Analytics"' },
  });
}

// Protect everything except Next internals and static assets.
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
