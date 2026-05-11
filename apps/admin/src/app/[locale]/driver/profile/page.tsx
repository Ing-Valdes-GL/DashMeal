"use client";

import { useRouter } from "next/navigation";
import { useDriverAuthStore } from "@/stores/driver-auth";

export default function DriverProfilePage() {
  const router = useRouter();
  const { driver, isAuthenticated, logout, updateDriver } = useDriverAuthStore();

  if (!isAuthenticated || !driver) {
    router.replace("/fr/driver/login");
    return null;
  }

  const handleLogout = () => {
    logout();
    router.replace("/fr/driver/login");
  };

  const toggleAvailability = async () => {
    const next = !driver.is_available;
    updateDriver({ is_available: next });
    try {
      await fetch(`${process.env.NEXT_PUBLIC_API_URL}/driver/profile/availability`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${document.cookie.match(/dm_driver_access_token=([^;]+)/)?.[1] ?? ""}`,
        },
        body: JSON.stringify({ is_available: next }),
      });
    } catch {}
  };

  return (
    <div className="px-4 py-4 space-y-4">
      <h1 className="text-slate-800 font-bold text-lg">Mon profil</h1>

      {/* Avatar + name */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 flex items-center gap-4">
        <div className="w-16 h-16 rounded-full bg-orange-100 flex items-center justify-center flex-shrink-0">
          {driver.avatar_url ? (
            <img src={driver.avatar_url} alt={driver.name} className="w-16 h-16 rounded-full object-cover" />
          ) : (
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#f97316" strokeWidth="2">
              <circle cx="12" cy="8" r="4"/><path d="M20 21a8 8 0 1 0-16 0"/>
            </svg>
          )}
        </div>
        <div>
          <p className="text-slate-800 font-bold text-base">{driver.name}</p>
          <p className="text-slate-500 text-sm">{driver.phone}</p>
          {driver.vehicle_type && (
            <p className="text-slate-400 text-xs mt-0.5 capitalize">{driver.vehicle_type}</p>
          )}
        </div>
      </div>

      {/* Availability toggle */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-slate-800 font-semibold text-sm">Disponibilité</p>
            <p className="text-slate-400 text-xs mt-0.5">
              {driver.is_available ? "Vous recevez des commandes" : "Vous ne recevez pas de commandes"}
            </p>
          </div>
          <button
            onClick={toggleAvailability}
            className={`relative w-12 h-6 rounded-full transition-colors ${driver.is_available ? "bg-emerald-500" : "bg-slate-300"}`}
          >
            <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${driver.is_available ? "left-6" : "left-0.5"}`} />
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Livraisons", value: "—" },
          { label: "Note",       value: "—" },
          { label: "Gains",      value: "—" },
        ].map((s) => (
          <div key={s.label} className="bg-white rounded-xl border border-slate-100 shadow-sm p-3 text-center">
            <p className="text-slate-800 font-bold text-lg">{s.value}</p>
            <p className="text-slate-400 text-xs">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Menu */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        {[
          { icon: "📄", label: "Mes documents" },
          { icon: "🔔", label: "Notifications" },
          { icon: "❓", label: "Aide & Support" },
        ].map((item) => (
          <button key={item.label} className="w-full flex items-center gap-3 px-4 py-3.5 border-b border-slate-50 last:border-0 text-left">
            <span className="text-base">{item.icon}</span>
            <span className="text-slate-700 text-sm font-medium flex-1">{item.label}</span>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#cbd5e1" strokeWidth="2">
              <path d="m9 18 6-6-6-6"/>
            </svg>
          </button>
        ))}
      </div>

      {/* Version */}
      <p className="text-center text-slate-400 text-xs">Dash Meal Livreur v1.0</p>

      {/* Logout */}
      <button
        onClick={handleLogout}
        className="w-full border border-red-200 bg-red-50 text-red-500 font-bold py-3.5 rounded-2xl text-sm"
      >
        Se déconnecter
      </button>

      <div className="h-4" />
    </div>
  );
}
