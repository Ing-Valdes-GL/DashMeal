"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { usePathname } from "next/navigation";
import { useAuthStore } from "@/stores/auth";
import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { Spinner } from "@/components/ui/spinner";
import { use } from "react";

export default function DashboardLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = use(params);
  const { isAuthenticated, user } = useAuthStore();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!isAuthenticated || !user) {
      router.push(`/${locale}/login`);
      return;
    }

    const isSuperadmin = user.role === "superadmin";

    // Superadmin trying to access admin-only routes → send to platform
    const adminOnlyPaths = ["/dashboard", "/orders", "/branches", "/delivery", "/drivers", "/collect", "/analytics", "/notifications", "/commissions"];
    if (isSuperadmin && adminOnlyPaths.some((p) => pathname.includes(p) && !pathname.includes("/superadmin"))) {
      router.replace(`/${locale}/superadmin/platform`);
      return;
    }

    // Admin trying to access superadmin routes → send to dashboard
    if (!isSuperadmin && pathname.includes("/superadmin/")) {
      router.replace(`/${locale}/dashboard`);
    }
  }, [isAuthenticated, user, locale, pathname, router]);

  if (!isAuthenticated || !user) {
    return (
      <div className="flex h-screen items-center justify-center bg-surface-950">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-surface-850">
      <Sidebar locale={locale} />
      <div className="flex-1 flex flex-col ml-64">
        <Header locale={locale} />
        <main className="flex-1 mt-16 p-6 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
