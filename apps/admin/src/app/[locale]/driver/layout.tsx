"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useDriverAuthStore } from "@/stores/driver-auth";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "deliveries", label: "Livraisons", icon: NavBike },
  { href: "earnings",   label: "Gains",      icon: NavWallet },
  { href: "profile",    label: "Profil",      icon: NavUser },
];

function NavBike({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active ? "#f97316" : "#94a3b8"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="18.5" cy="17.5" r="3.5"/><circle cx="5.5" cy="17.5" r="3.5"/>
      <path d="M15 6a1 1 0 0 0-1-1h-1M12 6l-3 6H5.5"/><path d="m12 6 2.5 5.5M15 12h3.5L17 6"/>
    </svg>
  );
}
function NavWallet({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active ? "#f97316" : "#94a3b8"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12V7H5a2 2 0 0 1 0-4h14v4"/><path d="M3 5v14a2 2 0 0 0 2 2h16v-5"/><path d="M18 12a2 2 0 0 0 0 4h4v-4Z"/>
    </svg>
  );
}
function NavUser({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active ? "#f97316" : "#94a3b8"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="8" r="4"/><path d="M20 21a8 8 0 1 0-16 0"/>
    </svg>
  );
}

export default function DriverLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { isAuthenticated } = useDriverAuthStore();

  const locale = pathname.split("/")[1] ?? "fr";
  const isLogin = pathname.includes("/driver/login");

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col max-w-md mx-auto relative">
      {/* Topbar */}
      {!isLogin && (
        <header className="sticky top-0 z-40 bg-white border-b border-slate-100 px-4 py-3 flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-orange-500 flex items-center justify-center">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="white" stroke="none">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14H9V8h2v8zm4 0h-2V8h2v8z"/>
              </svg>
            </div>
            <span className="font-bold text-slate-800 text-sm">Dash Meal <span className="text-orange-500">Livreur</span></span>
          </div>
          <OnlineToggle />
        </header>
      )}

      {/* Content */}
      <main className="flex-1 overflow-y-auto pb-20">
        {children}
      </main>

      {/* Bottom Nav */}
      {!isLogin && isAuthenticated && (
        <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md bg-white border-t border-slate-100 flex items-center justify-around px-2 py-2 z-50 shadow-lg">
          {NAV.map((item) => {
            const active = pathname.includes(`/driver/${item.href}`);
            return (
              <Link
                key={item.href}
                href={`/${locale}/driver/${item.href}`}
                className="flex flex-col items-center gap-0.5 px-4 py-1"
              >
                <item.icon active={active} />
                <span className={cn("text-[10px] font-semibold", active ? "text-orange-500" : "text-slate-400")}>
                  {item.label}
                </span>
              </Link>
            );
          })}
        </nav>
      )}
    </div>
  );
}

function OnlineToggle() {
  const { driver, updateDriver } = useDriverAuthStore();
  if (!driver) return null;

  const toggle = async () => {
    updateDriver({ is_available: !driver.is_available });
    try {
      await fetch(`/api/v1/driver/profile/availability`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_available: !driver.is_available }),
      });
    } catch {}
  };

  return (
    <button
      onClick={toggle}
      className={cn(
        "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold transition-colors",
        driver.is_available
          ? "bg-emerald-50 text-emerald-600 border border-emerald-200"
          : "bg-slate-100 text-slate-500 border border-slate-200"
      )}
    >
      <span className={cn("w-1.5 h-1.5 rounded-full", driver.is_available ? "bg-emerald-500 animate-pulse" : "bg-slate-400")} />
      {driver.is_available ? "En ligne" : "Hors ligne"}
    </button>
  );
}
