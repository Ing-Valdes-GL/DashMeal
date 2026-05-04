"use client";
import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { useBranchAuthStore } from "@/stores/branch-auth";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import logo from "@/assets/logo.png";
import {
  LayoutDashboard, ShoppingCart, Package, Wallet,
  Clock, LogOut, ChevronRight,
} from "lucide-react";

interface NavItem { href: string; label: string; icon: React.ComponentType<{ className?: string }> }

const NAV: NavItem[] = [
  { href: "/branch-dashboard", label: "Tableau de bord", icon: LayoutDashboard },
  { href: "/branch-orders",    label: "Commandes",       icon: ShoppingCart },
  { href: "/branch-stock",     label: "Stock",           icon: Package },
  { href: "/branch-wallet",    label: "Wallet",          icon: Wallet },
  { href: "/branch-hours",     label: "Horaires",        icon: Clock },
];

export default function BranchLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { locale: string };
}) {
  const { manager, isAuthenticated, logout } = useBranchAuthStore();
  const router   = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!isAuthenticated && !pathname.endsWith("/branch/login")) {
      router.replace(`/${params.locale}/branch/login`);
    }
  }, [isAuthenticated, pathname, params.locale, router]);

  if (!isAuthenticated) return null;

  const isActive = (href: string) => pathname.includes(href);

  const handleLogout = () => {
    logout();
    toast.success("Déconnexion réussie");
    router.push(`/${params.locale}/branch/login`);
  };

  return (
    <div className="flex h-screen bg-slate-50">
      {/* Sidebar */}
      <aside className="fixed inset-y-0 left-0 z-40 flex h-full w-60 flex-col bg-white border-r border-slate-200 shadow-sm">
        {/* Logo */}
        <div className="flex h-16 items-center gap-3 px-4 border-b border-slate-100">
          <Image src={logo} alt="Dash Meal" width={32} height={32} className="shrink-0 rounded-lg" unoptimized />
          <div>
            <span className="text-sm font-bold text-slate-900">Dash Meal</span>
            <p className="text-[10px] font-medium text-brand-600 uppercase tracking-wider">Agence</p>
          </div>
        </div>

        {/* Branch info */}
        <div className="mx-3 mt-3 rounded-xl bg-brand-50 border border-brand-100 px-3 py-2.5">
          <p className="text-[10px] font-semibold text-brand-500 uppercase tracking-wider">Agence active</p>
          <p className="text-sm font-bold text-brand-700 truncate">{manager?.name ?? "Mon agence"}</p>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
          {NAV.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={`/${params.locale}${item.href}`}
                className={cn(
                  "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all",
                  active
                    ? "bg-brand-600 text-white shadow-sm"
                    : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                )}
              >
                <Icon className={cn("h-4 w-4 shrink-0", active ? "text-white" : "text-slate-400 group-hover:text-brand-600")} />
                <span className="flex-1">{item.label}</span>
                {active && <ChevronRight className="h-3 w-3 opacity-60" />}
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="border-t border-slate-100 p-3">
          <div className="flex items-center gap-3 rounded-xl px-3 py-2 bg-slate-50 mb-1.5">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-600 text-white text-xs font-bold">
              {manager?.name?.slice(0, 2).toUpperCase() ?? "MG"}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-slate-800 truncate">{manager?.name}</p>
              <p className="text-[11px] text-slate-400 font-medium">Manager</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm text-slate-500 hover:bg-red-50 hover:text-red-600 transition-colors font-medium"
          >
            <LogOut className="h-4 w-4" />
            Déconnexion
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="ml-60 flex-1 overflow-y-auto p-6">{children}</main>
    </div>
  );
}
