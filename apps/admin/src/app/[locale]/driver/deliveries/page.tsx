"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useDriverAuthStore } from "@/stores/driver-auth";

type DeliveryStatus = "pending" | "accepted" | "picking_up" | "delivering" | "delivered" | "cancelled";

interface Delivery {
  id: string;
  order_number: string;
  status: DeliveryStatus;
  customer_name: string;
  customer_phone: string;
  delivery_address: string;
  distance_km: number;
  amount: number;
  commission: number;
  items_count: number;
  branch_name: string;
  branch_address: string;
  created_at: string;
  accepted_at?: string;
}

const STATUS_CONFIG: Record<DeliveryStatus, { label: string; color: string; bg: string }> = {
  pending:    { label: "Nouveau",      color: "text-orange-600", bg: "bg-orange-50 border-orange-200" },
  accepted:   { label: "Accepté",      color: "text-blue-600",   bg: "bg-blue-50 border-blue-200" },
  picking_up: { label: "En récupération", color: "text-purple-600", bg: "bg-purple-50 border-purple-200" },
  delivering: { label: "En livraison", color: "text-emerald-600", bg: "bg-emerald-50 border-emerald-200" },
  delivered:  { label: "Livré",        color: "text-slate-500",  bg: "bg-slate-50 border-slate-200" },
  cancelled:  { label: "Annulé",       color: "text-red-500",    bg: "bg-red-50 border-red-200" },
};

function formatCFA(amount: number) {
  return amount.toLocaleString("fr-FR") + " F";
}

function timeAgo(dateStr: string) {
  const diff = (Date.now() - new Date(dateStr).getTime()) / 60000;
  if (diff < 1) return "À l'instant";
  if (diff < 60) return `Il y a ${Math.round(diff)} min`;
  if (diff < 1440) return `Il y a ${Math.round(diff / 60)}h`;
  return new Date(dateStr).toLocaleDateString("fr-FR");
}

async function fetchDeliveries(token: string | undefined): Promise<Delivery[]> {
  if (!token) return [];
  const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/driver/deliveries`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return [];
  const body = await res.json();
  return body.data ?? [];
}

function getToken() {
  if (typeof document === "undefined") return undefined;
  return document.cookie.match(/dm_driver_access_token=([^;]+)/)?.[1];
}

export default function DriverDeliveriesPage() {
  const router = useRouter();
  const { driver, isAuthenticated } = useDriverAuthStore();
  const [tab, setTab] = useState<"active" | "history">("active");

  if (!isAuthenticated) {
    router.replace("/fr/driver/login");
    return null;
  }

  const { data: deliveries = [], isLoading, refetch } = useQuery<Delivery[]>({
    queryKey: ["driver-deliveries"],
    queryFn: () => fetchDeliveries(getToken()),
    refetchInterval: 15_000,
  });

  const active = deliveries.filter((d) => !["delivered", "cancelled"].includes(d.status));
  const history = deliveries.filter((d) => ["delivered", "cancelled"].includes(d.status));
  const shown = tab === "active" ? active : history;

  return (
    <div className="flex flex-col min-h-full">
      {/* Header */}
      <div className="px-4 pt-4 pb-0">
        <h1 className="text-slate-800 font-bold text-lg">Mes livraisons</h1>
        <p className="text-slate-400 text-xs mt-0.5">{active.length} en cours · {history.length} terminées</p>
      </div>

      {/* Tabs */}
      <div className="flex mx-4 mt-4 bg-slate-100 rounded-xl p-1 gap-1">
        {[{ key: "active", label: `En cours (${active.length})` }, { key: "history", label: "Historique" }].map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key as any)}
            className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-colors ${
              tab === t.key ? "bg-white text-slate-800 shadow-sm" : "text-slate-500"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* List */}
      <div className="flex-1 px-4 py-4 space-y-3">
        {isLoading ? (
          <div className="flex justify-center py-12">
            <div className="w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : shown.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
            <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="1.5">
                <circle cx="18.5" cy="17.5" r="3.5"/><circle cx="5.5" cy="17.5" r="3.5"/>
                <path d="M15 6a1 1 0 0 0-1-1h-1M12 6l-3 6H5.5M12 6l2.5 5.5M15 12h3.5L17 6"/>
              </svg>
            </div>
            <div>
              <p className="text-slate-600 font-semibold">
                {tab === "active" ? "Aucune livraison en cours" : "Aucun historique"}
              </p>
              <p className="text-slate-400 text-xs mt-1">
                {tab === "active" ? "Passez en ligne pour recevoir des commandes" : "Vos livraisons terminées apparaîtront ici"}
              </p>
            </div>
          </div>
        ) : (
          shown.map((delivery) => {
            const cfg = STATUS_CONFIG[delivery.status];
            return (
              <button
                key={delivery.id}
                onClick={() => router.push(`/fr/driver/deliveries/${delivery.id}`)}
                className="w-full text-left bg-white rounded-2xl border border-slate-100 shadow-sm p-4 active:scale-[0.98] transition-transform"
              >
                {/* Top row */}
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <span className="text-slate-800 font-bold text-sm">#{delivery.order_number}</span>
                    <span className="text-slate-400 text-xs ml-2">{timeAgo(delivery.created_at)}</span>
                  </div>
                  <span className={`text-xs font-semibold px-2 py-1 rounded-full border ${cfg.color} ${cfg.bg}`}>
                    {cfg.label}
                  </span>
                </div>

                {/* Branch → Customer */}
                <div className="space-y-1.5 mb-3">
                  <div className="flex items-start gap-2">
                    <div className="w-5 h-5 rounded-full bg-orange-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <div className="w-2 h-2 rounded-full bg-orange-500" />
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">Récupérer chez</p>
                      <p className="text-sm font-semibold text-slate-700">{delivery.branch_name}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <div className="w-5 h-5 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <div className="w-2 h-2 rounded-full bg-emerald-500" />
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">Livrer à</p>
                      <p className="text-sm font-semibold text-slate-700">{delivery.customer_name}</p>
                      <p className="text-xs text-slate-400">{delivery.delivery_address}</p>
                    </div>
                  </div>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between pt-2 border-t border-slate-50">
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-slate-500">{delivery.items_count} article{delivery.items_count > 1 ? "s" : ""}</span>
                    <span className="text-xs text-slate-400">·</span>
                    <span className="text-xs text-slate-500">{delivery.distance_km} km</span>
                  </div>
                  <div className="text-right">
                    <p className="text-orange-500 font-bold text-sm">{formatCFA(delivery.commission)}</p>
                    <p className="text-slate-400 text-[10px]">commission</p>
                  </div>
                </div>
              </button>
            );
          })
        )}
      </div>

      {/* Pull to refresh hint */}
      <div className="text-center pb-4">
        <button onClick={() => refetch()} className="text-slate-400 text-xs">Actualiser</button>
      </div>
    </div>
  );
}
