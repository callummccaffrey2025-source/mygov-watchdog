import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

export function middleware(req: NextRequest) {
  // allow these routes without auth
  const PUBLIC_PREFIXES = ["/", "/bills", "/news", "/mps", "/pricing"];

  // NOTE: parens avoid ?? precedence issues
  const pathname = (req.nextUrl?.pathname ?? "/");

  if (PUBLIC_PREFIXES.some(p => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // if you still want onboarding in future, uncomment:
  // const url = req.nextUrl.clone();
  // url.pathname = "/onboarding";
  // url.searchParams.set("next", pathname);
  // return NextResponse.redirect(url);

  return NextResponse.next();
}
