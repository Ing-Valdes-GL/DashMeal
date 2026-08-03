import createMiddleware from "next-intl/middleware";
import { type NextRequest, NextResponse } from "next/server";
import { routing } from "./src/i18n/routing";

const intlMiddleware = createMiddleware(routing);

// Tes sous-routes publiques
const PUBLIC_PREFIXES = ["/login", "/signin", "/superadmin/auth"];

export default function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Extraire la locale du chemin
  const localeMatch = pathname.match(/^\/(fr|en)/);
  const locale = localeMatch ? localeMatch[1] : routing.defaultLocale;

  // Retirer le préfixe locale pour vérifier le chemin
  const pathnameWithoutLocale = pathname.replace(/^\/(fr|en)/, "") || "/";

  // 1. Vérifier si c'est la racine OU si le chemin commence par une route publique
  const isHomePage = pathnameWithoutLocale === "/";
  const isPublicPrefix = PUBLIC_PREFIXES.some((p) => pathnameWithoutLocale.startsWith(p));

  if (isHomePage || isPublicPrefix) {
    return intlMiddleware(request);
  }

  // 2. Vérification des tokens pour toutes les autres routes (protégées)
  const accessToken  = request.cookies.get("dm_access_token")?.value;
  const refreshToken = request.cookies.get("dm_refresh_token")?.value;

  if (!accessToken && !refreshToken) {
    const loginUrl = new URL(`/${locale}/login`, request.url);
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return intlMiddleware(request);
}

export const config = {
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
};