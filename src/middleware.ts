import { NextResponse, NextRequest } from 'next/server';

export function middleware(req: NextRequest) {
  const url = new URL(req.url);
  if (url.hostname === 'www.verity.run') {
    url.hostname = 'verity.run';
    return NextResponse.redirect(url, 308);
  }
  return NextResponse.next(); // no auth blocks
}

export const config = {
  // run on all paths except static assets/_next
  matcher: ['/((?!_next/|.*\\..*).*)'],
};
