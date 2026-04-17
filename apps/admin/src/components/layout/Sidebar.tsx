"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { useAuthStore } from "@/stores/auth";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard, ShoppingCart, Store, Truck, QrCode,
  BarChart2, Bell, DollarSign, Settings, Building2, FileText,
  Users, Activity, Globe, ChevronRight, LogOut, Zap, UserCheck,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "@/hooks/use-toast";

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: number;
}

export function Sidebar({ locale }: { locale: string }) {
  const t = useTranslations("nav");
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuthStore();

  const isActive = (href: string) => {
    const localePath = `/${locale}${href}`;
    return pathname === localePath || pathname.startsWith(localePath + "/");
  };

  const handleLogout = () => {
    const isSuperadmin = user?.role === "superadmin";
    logout();
    toast.success(t("logout"));
    router.push(`/${locale}/${isSuperadmin ? "superadmin/auth" : "login"}`);
  };

  const adminNav: NavItem[] = [
    { href: "/dashboard",     label: t("dashboard"),     icon: LayoutDashboard },
    { href: "/orders",        label: t("orders"),        icon: ShoppingCart },
    { href: "/branches",      label: t("branches"),      icon: Store },
    { href: "/delivery",      label: t("delivery"),      icon: Truck },
    { href: "/drivers",       label: t("drivers"),       icon: UserCheck },
    { href: "/collect",       label: t("collect"),       icon: QrCode },
    { href: "/analytics",     label: t("analytics"),     icon: BarChart2 },
    { href: "/notifications", label: t("notifications"), icon: Bell },
    { href: "/settings",      label: t("settings"),      icon: Settings },
  ];

  const superadminNav: NavItem[] = [
    { href: "/superadmin/platform",     label: t("platform"),     icon: Globe },
    { href: "/superadmin/brands",       label: t("brands"),       icon: Building2 },
    { href: "/superadmin/applications", label: t("applications"), icon: FileText },
    { href: "/superadmin/users",        label: t("users"),        icon: Users },
    { href: "/superadmin/commissions",  label: t("commissions"),  icon: DollarSign },
    { href: "/superadmin/audit",        label: t("audit"),        icon: Activity },
    { href: "/settings",                label: t("settings"),     icon: Settings },
  ];

  return (
    <aside className="fixed inset-y-0 left-0 z-40 flex h-full w-64 flex-col border-r border-surface-700/50 bg-surface-900">
      {/* Logo */}
      <div className="flex h-16 items-center gap-3 border-b border-surface-700/50 px-5">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-500 shadow-lg shadow-brand-500/30">
          <Zap className="h-4 w-4 text-white" />
        </div>
        <div>
          <span className="text-base font-bold text-white">Dash Meal</span>
          <p className="text-[10px] text-slate-500 -mt-0.5">
            {user?.role === "superadmin" ? "Super Admin" : "Admin Panel"}
          </p>
        </div>
      </div>

      {/* Brand info (admin only) */}
      {user?.role === "admin" && user.brand_name && (
        <div className="mx-3 mt-3 rounded-lg bg-brand-500/10 border border-brand-500/20 px-3 py-2">
          <p className="text-xs text-slate-500">Marque</p>
          <p className="text-sm font-semibold text-brand-400 truncate">{user.brand_name}</p>
        </div>
      )}

      {/* Navigation principale */}
      <nav className="flex-1 overflow-y-auto py-3 px-3 space-y-0.5">
        {(user?.role === "superadmin" ? superadminNav : adminNav).map((item) => (
          <NavLink key={item.href} item={item} locale={locale} active={isActive(item.href)} />
        ))}
      </nav>

      {/* User footer */}
      <div className="border-t border-surface-700/50 p-3">
        <div className="flex items-center gap-3 rounded-lg px-2 py-2 mb-1">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-500/20 text-brand-400 text-xs font-bold">
            {user?.username?.slice(0, 2).toUpperCase() ?? "AD"}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white truncate">{user?.username ?? "Admin"}</p>
            <p className="text-xs text-slate-500 capitalize">{user?.role}</p>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-400 hover:bg-surface-700 hover:text-red-400 transition-colors"
        >
          <LogOut className="h-4 w-4" />
          {t("logout")}
        </button>
      </div>
    </aside>
  );
}

function NavLink({
  item, locale, active,
}: {
  item: NavItem;
  locale: string;
  active: boolean;
}) {
  const Icon = item.icon;
  return (
    <Link
      href={`/${locale}${item.href}`}
      className={cn(
        "group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-150",
        active
          ? "bg-brand-500/15 text-brand-400 border border-brand-500/20"
          : "text-slate-400 hover:bg-surface-700/60 hover:text-white"
      )}
    >
      <Icon className={cn("h-4 w-4 shrink-0", active && "text-brand-500")} />
      <span className="flex-1">{item.label}</span>
      {active && <ChevronRight className="h-3 w-3 opacity-50" />}
    </Link>
  );
}
