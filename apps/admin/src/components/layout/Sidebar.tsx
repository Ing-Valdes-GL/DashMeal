"use client";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useAuthStore } from "@/stores/auth";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import { apiGet } from "@/lib/api";
import logo from "@/assets/logo.png";
import {
  LayoutDashboard, ShoppingCart, Store, Truck, QrCode,
  BarChart2, Bell, Settings, Building2, FileText,
  Users, Activity, Globe, ChevronRight, LogOut,
  UserCheck, Wallet, DollarSign, Megaphone, UsersRound,
  Tag, LayoutGrid, ClipboardCheck, Download, MapPin,
} from "lucide-react";

interface NavItem {
  href:   string;
  label:  string;
  icon:   React.ComponentType<{ className?: string }>;
  badge?: number;
}


export function Sidebar({ locale }: { locale: string }) {
  const t = useTranslations("nav");
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuthStore();
  const isSuperadmin = user?.role === "superadmin";

  const { data: pendingData } = useQuery<{ pagination: { total: number } }>({
    queryKey: ["orders-pending-count"],
    queryFn: () => apiGet("/orders", { status: "pending", limit: 1 }) as any,
    refetchInterval: 30_000,
    enabled: !isSuperadmin,
    staleTime: 0,
  });
  const pendingCount = pendingData?.pagination?.total ?? 0;

  const isActive = (href: string) => {
    const localePath = `/${locale}${href}`;
    return pathname === localePath || pathname.startsWith(localePath + "/");
  };

  const handleLogout = () => {
    logout();
    toast.success(t("logout"));
    router.push(`/${locale}/${isSuperadmin ? "superadmin/auth" : "login"}`);
  };

  const adminNav: NavItem[] = [
    { href: "/dashboard",       label: t("dashboard"),      icon: LayoutDashboard },
    { href: "/orders",          label: t("orders"),         icon: ShoppingCart, badge: pendingCount },
    { href: "/orders/global",   label: t("globalOrders"),   icon: LayoutGrid },
    { href: "/branches",        label: t("branches"),       icon: Store },
    { href: "/delivery",        label: t("delivery"),       icon: Truck },
    { href: "/delivery-zones",  label: t("deliveryZones"),  icon: MapPin },
    { href: "/drivers",         label: t("drivers"),        icon: UserCheck },
    { href: "/drivers/kyc",     label: t("kyc"),            icon: ClipboardCheck },
    { href: "/branch-managers", label: t("branchManagers"), icon: UsersRound },
    { href: "/collect",         label: t("collect"),        icon: QrCode },
    { href: "/analytics",       label: t("analytics"),      icon: BarChart2 },
    { href: "/promotions",      label: t("promotions"),     icon: Tag },
    { href: "/wallet",          label: t("wallet"),         icon: Wallet },
    { href: "/ads",             label: t("ads"),            icon: Megaphone },
    { href: "/reports",         label: t("reports"),        icon: Download },
    { href: "/notifications",   label: t("notifications"),  icon: Bell },
    { href: "/settings",        label: t("settings"),       icon: Settings },
  ];

  const superadminNav: NavItem[] = [
    { href: "/superadmin/platform",     label: t("platform"),     icon: Globe },
    { href: "/superadmin/brands",       label: t("brands"),       icon: Building2 },
    { href: "/superadmin/applications", label: t("applications"), icon: FileText },
    { href: "/superadmin/users",        label: t("users"),        icon: Users },
    { href: "/superadmin/commissions",  label: t("commissions"),  icon: DollarSign },
    { href: "/superadmin/ads",          label: t("ads"),          icon: Megaphone },
    { href: "/superadmin/wallet",       label: t("wallet"),       icon: Wallet },
    { href: "/superadmin/audit",        label: t("audit"),        icon: Activity },
    { href: "/settings",                label: t("settings"),     icon: Settings },
  ];

  const nav = isSuperadmin ? superadminNav : adminNav;
  const initials = user?.username?.slice(0, 2).toUpperCase() ?? "AD";

  return (
    <aside className="fixed inset-y-0 left-0 z-40 flex h-full w-64 flex-col bg-white border-r border-slate-200 shadow-[2px_0_12px_0_rgba(0,0,0,0.04)]">

      {/* ── Logo ──────────────────────────────────────────────────── */}
      <div className="flex h-16 items-center gap-3 px-5 border-b border-slate-100">
        <Image src={logo} alt="Dash Meal" width={36} height={36} className="shrink-0 rounded-lg" unoptimized />
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
        <span className="relative flex">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-60 bg-orange-400" />
          <span className={cn(
            "relative flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[10px] font-bold",
            active ? "bg-white/30 text-white" : "bg-orange-500 text-white"
          )}>
            {item.badge > 99 ? "99+" : item.badge}
          </span>
        </span>
      )}
      {active && <ChevronRight className="h-3 w-3 opacity-60 shrink-0" />}
    </Link>
  );
}
