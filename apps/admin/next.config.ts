import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";
import path from "path";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const baseConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "*.supabase.co" },
      { protocol: "https", hostname: "*.supabase.in" },
    ],
  },
};

const config = withNextIntl(baseConfig) as any;

// next-intl injects experimental.turbo (old format) — migrate to turbopack
const intlAlias = config.experimental?.turbo?.resolveAlias ?? {};
if (config.experimental?.turbo) delete config.experimental.turbo;

// turbopack.root MUST be the workspace root (monorepo root), not apps/admin,
// so Turbopack can access node_modules/.pnpm/* through pnpm symlinks.
const workspaceRoot = path.resolve(process.cwd(), "../..");

config.turbopack = {
  root: workspaceRoot,
  resolveAlias: { ...intlAlias, ...config.turbopack?.resolveAlias },
};

export default config;
