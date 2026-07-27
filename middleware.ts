import { NextResponse, type NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const isProtectedSurface = request.nextUrl.pathname.startsWith("/dashboard") ||
    request.nextUrl.pathname.startsWith("/transactions");
  const hasSessionCookie = request.cookies.has("bayaraman_session");

  if (isProtectedSurface && !hasSessionCookie) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", request.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/transactions/:path*"]
};
