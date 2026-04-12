import createMiddleware from "next-intl/middleware";
import { type NextRequest, NextResponse } from "next/server";
import { routing } from "./src/i18n/routing";

const intlMiddleware = createMiddleware(routing);

const PUBLIC_PATHS = ["/login"];

export default function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Retirer le préfixe locale pour vérifier le chemin
  const pathnameWithoutLocale = pathname.replace(/^\/(fr|en)/, "") || "/";

  // Routes publiques : laisser passer
  if (PUBLIC_PATHS.some((p) => pathnameWithoutLocale.startsWith(p))) {
    return intlMiddleware(request);
  }

  // Vérifier le token JWT
  const token = request.cookies.get("dm_access_token")?.value;
  if (!token) {
    const loginUrl = new URL(
      `/${pathname.split("/")[1] || routing.defaultLocale}/login`,
      request.url
    );
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return intlMiddleware(request);
}

export const config = {
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
};
