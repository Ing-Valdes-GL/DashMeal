"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useAuthStore } from "@/stores/auth";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import {
  LayoutDashboard, ShoppingCart, Store, Truck, QrCode,
  BarChart2, Bell, Settings, Building2, FileText,
  Users, Activity, Globe, ChevronRight, LogOut,
  UserCheck, Wallet, DollarSign,
} from "lucide-react";

interface NavItem {
  href:   string;
  label:  string;
  icon:   React.ComponentType<{ className?: string }>;
  badge?: number;
}

function DashMealLogo({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="40" height="40" rx="10" fill="#16a34a"/>
      <path d="M20 8C13.373 8 8 13.373 8 20s5.373 12 12 12 12-5.373 12-12S26.627 8 20 8z" fill="#22c55e" opacity="0.4"/>
      <path d="M14 16h2v10h-2V16zm4-2h2v14h-2V14zm4 4h2v10h-2V18zm4-3h2v13h-2V15z" fill="white"/>
      <circle cx="30" cy="12" r="4" fill="#eab308"/>
      <path d="M29 11l1 1 2-2" stroke="white" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
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
    { href: "/wallet",        label: t("wallet"),        icon: Wallet },
    { href: "/notifications", label: t("notifications"), icon: Bell },
    { href: "/settings",      label: t("settings"),      icon: Settings },
  ];

  const superadminNav: NavItem[] = [
    { href: "/superadmin/platform",     label: t("platform"),     icon: Globe },
    { href: "/superadmin/brands",       label: t("brands"),       icon: Building2 },
    { href: "/superadmin/applications", label: t("applications"), icon: FileText },
    { href: "/superadmin/users",        label: t("users"),        icon: Users },
    { href: "/superadmin/commissions",  label: t("commissions"),  icon: DollarSign },
    { href: "/superadmin/wallet",       label: t("wallet"),       icon: Wallet },
    { href: "/superadmin/audit",        label: t("audit"),        icon: Activity },
    { href: "/settings",                label: t("settings"),     icon: Settings },
  ];

  const isSuperadmin = user?.role === "superadmin";
  const nav = isSuperadmin ? superadminNav : adminNav;
  const initials = user?.username?.slice(0, 2).toUpperCase() ?? "AD";

  return (
    <aside className="fixed inset-y-0 left-0 z-40 flex h-full w-64 flex-col bg-white border-r border-slate-200 shadow-[2px_0_12px_0_rgba(0,0,0,0.04)]">

      {/* ── Logo ──────────────────────────────────────────────────── */}
      <div className="flex h-16 items-center gap-3 px-5 border-b border-slate-100">
        <DashMealLogo className="h-9 w-9 shrink-0" />
        <div>
          <span className="text-base font-bold text-slate-900 tracking-tight">Dash Meal</span>
          <p className="text-[10px] font-medium text-slate-400 -mt-0.5 uppercase tracking-wider">
            {isSuperadmin ? "Super Admin" : "Admin Panel"}
          </p>
        </div>
      </div>

      {/* ── Marque (admin uniquement) ─────────────────────────────── */}
      {!isSuperadmin && user?.brand_name && (
        <div className="mx-3 mt-3 rounded-xl bg-brand-50 border border-brand-100 px-3 py-2.5">
          <p className="text-[10px] font-semibold text-brand-500 uppercase tracking-wider mb-0.5">Marque active</p>
          <p className="text-sm font-bold text-brand-700 truncate">{user.brand_name}</p>
        </div>
      )}

      {/* ── Navigation ───────────────────────────────────────────── */}
      <nav className="flex-1 overflow-y-auto py-3 px-2.5 space-y-0.5">
        {nav.map((item) => (
          <NavLink key={item.href} item={item} locale={locale} active={isActive(item.href)} />
        ))}
      </nav>

      {/* ── Footer utilisateur ────────────────────────────────────── */}
      <div className="border-t border-slate-100 p-3">
        <div className="flex items-center gap-3 rounded-xl px-3 py-2.5 bg-slate-50 mb-1.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand-500 to-brand-700 text-white text-xs font-bold shadow-green">
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-slate-800 truncate">{user?.username ?? "Admin"}</p>
            <p className="text-[11px] text-slate-400 capitalize font-medium">{user?.role}</p>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm text-slate-500 hover:bg-red-50 hover:text-red-600 transition-colors duration-150 font-medium"
        >
          <LogOut className="h-4 w-4" />
          {t("logout")}
        </button>
      </div>
    </aside>
  );
}

function NavLink({ item, locale, active }: { item: NavItem; locale: string; active: boolean }) {
  const Icon = item.icon;
  return (
    <Link
      href={`/${locale}${item.href}`}
      className={cn(
        "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-150",
        active
          ? "bg-brand-600 text-white shadow-green"
          : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
      )}
    >
      <Icon className={cn(
        "h-4 w-4 shrink-0 transition-colors",
        active ? "text-white" : "text-slate-400 group-hover:text-brand-600"
      )} />
      <span className="flex-1">{item.label}</span>
      {item.badge != null && item.badge > 0 && (
        <span className={cn(
          "flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[10px] font-bold",
          active ? "bg-white/20 text-white" : "bg-accent-100 text-accent-700"
        )}>
          {item.badge > 99 ? "99+" : item.badge}
        </span>
      )}
      {active && <ChevronRight className="h-3 w-3 opacity-60 shrink-0" />}
    </Link>
  );
}
