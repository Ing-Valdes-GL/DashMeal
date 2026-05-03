import createMiddleware from "next-intl/middleware";
import { type NextRequest, NextResponse } from "next/server";
import { routing } from "./src/i18n/routing";

const intlMiddleware = createMiddleware(routing);

const PUBLIC_PATHS = ["/login", "/signin", "/superadmin/auth"];

export default function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Extraire la locale du chemin
  const localeMatch = pathname.match(/^\/(fr|en)/);
  const locale = localeMatch ? localeMatch[1] : routing.defaultLocale;

  // Retirer le préfixe locale pour vérifier le chemin
  const pathnameWithoutLocale = pathname.replace(/^\/(fr|en)/, "") || "/";

  // Routes publiques : laisser passer
  if (PUBLIC_PATHS.some((p) => pathnameWithoutLocale.startsWith(p))) {
    return intlMiddleware(request);
  }

  // Vérifier la présence d'un token (access ou refresh)
  // L'intercepteur Axios gère le renouvellement côté client si l'access token est expiré
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
