"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";

type Period = "today" | "week" | "month";

interface EarningsSummary {
  total_commission: number;
  total_deliveries: number;
  avg_per_delivery: number;
  distance_km: number;
  daily: { date: string; amount: number; count: number }[];
}

function getToken() {
  if (typeof document === "undefined") return "";
  return document.cookie.match(/dm_driver_access_token=([^;]+)/)?.[1] ?? "";
}

function formatCFA(n: number) { return n.toLocaleString("fr-FR") + " F"; }

export default function DriverEarningsPage() {
  const [period, setPeriod] = useState<Period>("week");

  const { data, isLoading } = useQuery<EarningsSummary>({
    queryKey: ["driver-earnings", period],
    queryFn: async () => {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/driver/earnings?period=${period}`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      const body = await res.json();
      return body.data ?? { total_commission: 0, total_deliveries: 0, avg_per_delivery: 0, distance_km: 0, daily: [] };
    },
  });

  const PERIODS: { key: Period; label: string }[] = [
    { key: "today", label: "Aujourd'hui" },
    { key: "week",  label: "Cette semaine" },
    { key: "month", label: "Ce mois" },
  ];

  const maxAmount = data?.daily?.reduce((m, d) => Math.max(m, d.amount), 1) ?? 1;

  return (
    <div className="px-4 py-4 space-y-4">
      <h1 className="text-slate-800 font-bold text-lg">Mes gains</h1>

      {/* Period tabs */}
      <div className="flex bg-slate-100 rounded-xl p-1 gap-1">
        {PERIODS.map((p) => (
          <button
            key={p.key}
            onClick={() => setPeriod(p.key)}
            className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-colors ${
              period === p.key ? "bg-white text-slate-800 shadow-sm" : "text-slate-500"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <>
          {/* Main stat */}
          <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-3xl p-6 text-white shadow-lg shadow-orange-500/25">
            <p className="text-orange-100 text-sm font-medium">Gains totaux</p>
            <p className="text-4xl font-bold mt-1">{formatCFA(data?.total_commission ?? 0)}</p>
            <div className="flex items-center gap-4 mt-4 pt-4 border-t border-orange-400/40">
              <div>
                <p className="text-orange-200 text-xs">Livraisons</p>
                <p className="text-white font-bold text-lg">{data?.total_deliveries ?? 0}</p>
              </div>
              <div className="w-px h-8 bg-orange-400/40" />
              <div>
                <p className="text-orange-200 text-xs">Moy. / livraison</p>
                <p className="text-white font-bold text-lg">{formatCFA(data?.avg_per_delivery ?? 0)}</p>
              </div>
              <div className="w-px h-8 bg-orange-400/40" />
              <div>
                <p className="text-orange-200 text-xs">Distance</p>
                <p className="text-white font-bold text-lg">{data?.distance_km ?? 0} km</p>
              </div>
            </div>
          </div>

          {/* Bar chart */}
          {data?.daily && data.daily.length > 0 && (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
              <h2 className="text-slate-800 font-bold text-sm mb-4">Évolution</h2>
              <div className="flex items-end gap-2 h-28">
                {data.daily.map((d) => {
                  const pct = maxAmount > 0 ? (d.amount / maxAmount) * 100 : 0;
                  const dateLabel = new Date(d.date).toLocaleDateString("fr-FR", { weekday: "short" });
                  return (
                    <div key={d.date} className="flex flex-col items-center gap-1 flex-1">
                      <p className="text-[9px] text-slate-400">{d.amount > 0 ? formatCFA(d.amount) : ""}</p>
                      <div className="w-full flex items-end" style={{ height: 72 }}>
                        <div
                          className="w-full rounded-t-lg bg-orange-400 transition-all"
                          style={{ height: `${Math.max(4, pct)}%` }}
                        />
                      </div>
                      <p className="text-[9px] text-slate-400 capitalize">{dateLabel}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Daily breakdown */}
          {data?.daily && data.daily.length > 0 && (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-100">
                <h2 className="text-slate-800 font-bold text-sm">Détail journalier</h2>
              </div>
              <div className="divide-y divide-slate-50">
                {data.daily.filter((d) => d.amount > 0).map((d) => (
                  <div key={d.date} className="flex items-center justify-between px-4 py-3">
                    <div>
                      <p className="text-slate-700 text-sm font-medium capitalize">
                        {new Date(d.date).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "short" })}
                      </p>
                      <p className="text-slate-400 text-xs">{d.count} livraison{d.count > 1 ? "s" : ""}</p>
                    </div>
                    <p className="text-orange-500 font-bold text-sm">{formatCFA(d.amount)}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
