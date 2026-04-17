import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const baseConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "*.supabase.co" },
      { protocol: "https", hostname: "*.supabase.in" },
    ],
  },
};

// next-intl injects experimental.turbo (old format); Next.js 16 uses turbopack.
// Migrate the alias and remove the stale experimental.turbo key.
const config = withNextIntl(baseConfig) as NextConfig & {
  experimental?: { turbo?: { resolveAlias?: Record<string, string> } };
};

const intlAlias = config.experimental?.turbo?.resolveAlias ?? {};
delete config.experimental?.turbo;

config.turbopack = {
  root: process.cwd(),
  resolveAlias: {
    ...intlAlias,
    ...(config.turbopack as any)?.resolveAlias,
  },
};

export default config;
