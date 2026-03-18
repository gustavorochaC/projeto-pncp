import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

export async function proxy(request: NextRequest) {
  const isStaticChunkRequest = request.nextUrl.pathname.startsWith("/_next/static/chunks/");
  const hasRawRouteGroup = /\/_next\/static\/chunks\/.*[()]/.test(request.url);

  if (isStaticChunkRequest && hasRawRouteGroup) {
    return NextResponse.redirect(
      request.url.replace(/\(/g, "%28").replace(/\)/g, "%29")
    );
  }

  if (isStaticChunkRequest) {
    return NextResponse.next();
  }

  return updateSession(request);
}

export const config = {
  matcher: [
    "/_next/static/chunks/:path*",
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"
  ]
};
