import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  locales: ["fr", "en"],
  defaultLocale: "fr",
  pathnames: {
    "/": "/",
    "/login": "/login",
    "/signin": "/signin",
    "/dashboard": "/dashboard",
    "/orders": "/orders",
    "/products": "/products",
    "/branches": "/branches",
    "/delivery": "/delivery",
    "/collect": "/collect",
    "/analytics": "/analytics",
    "/notifications": "/notifications",
    "/commissions": "/commissions",
    "/settings": "/settings",
    "/superadmin/auth": "/superadmin/auth",
    "/superadmin/brands": "/superadmin/brands",
    "/superadmin/applications": "/superadmin/applications",
    "/superadmin/users": "/superadmin/users",
    "/superadmin/audit": "/superadmin/audit",
    "/superadmin/platform": "/superadmin/platform",
  },
});
