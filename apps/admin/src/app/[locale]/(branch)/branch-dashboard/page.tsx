"use client";
import { useQuery } from "@tanstack/react-query";
import { branchApiGet } from "@/lib/branch-api";
import { useBranchAuthStore } from "@/stores/branch-auth";
import { formatCurrency } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { DollarSign, ShoppingCart, Clock, AlertTriangle, TrendingUp, Package } from "lucide-react";

interface DashboardData {
  pending_orders: number;
  today: { revenue: number; orders: number; out_of_stock: number };
  period: { revenue: number; orders: number; delivered: number; conversion_rate: number };
  revenue_by_day: { date: string; revenue: number; orders: number }[];
  top_products: { name: string; revenue: number; quantity: number }[];
}

interface StockAlert {
  stock_qty: number;
  products: { name_fr: string };
}

export default function BranchDashboardPage() {
  const { manager } = useBranchAuthStore();

  const { data: dash, isLoading } = useQuery<DashboardData>({
    queryKey: ["branch-dashboard"],
    queryFn:  () => branchApiGet("/analytics/dashboard"),
    refetchInterval: 60_000,
  });

  const { data: alerts } = useQuery<StockAlert[]>({
    queryKey: ["branch-stock-alerts", manager?.branch_id],
    queryFn:  () => branchApiGet(`/stock/${manager?.branch_id}/alerts`, { threshold: 5 }),
    enabled:  !!manager?.branch_id,
  });

  const kpis = [
    { label: "CA aujourd'hui",     value: dash ? formatCurrency(dash.today.revenue)  : "—", icon: DollarSign,    bg: "bg-brand-50  border-brand-100",  color: "text-brand-600" },
    { label: "Commandes aujourd'hui", value: dash ? String(dash.today.orders)         : "—", icon: ShoppingCart, bg: "bg-blue-50   border-blue-100",   color: "text-blue-600"  },
    { label: "En attente",         value: dash ? String(dash.pending_orders)          : "—", icon: Clock,        bg: "bg-yellow-50 border-yellow-100",  color: "text-yellow-600", urgent: (dash?.pending_orders ?? 0) > 3 },
    { label: "Ruptures de stock",  value: dash ? String(dash.today.out_of_stock)     : "—", icon: AlertTriangle, bg: "bg-red-50    border-red-100",     color: "text-red-600",    urgent: (dash?.today.out_of_stock ?? 0) > 0 },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Tableau de bord</h1>
        <p className="text-sm text-slate-500 mt-0.5">Vue en temps réel de votre agence</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        {kpis.map((k) => {
          const Icon = k.icon;
          return (
            <Card key={k.label} className={`border ${k.bg}`}>
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">{k.label}</p>
                    {isLoading ? <Skeleton className="mt-2 h-8 w-20" /> : (
                      <p className="mt-1.5 text-3xl font-bold text-slate-900">{k.value}</p>
                    )}
                    {k.urgent && <p className="mt-1 text-xs text-red-600 font-medium">Attention requise</p>}
                  </div>
                  <div className={`rounded-xl p-2.5 ${k.bg} border`}>
                    <Icon className={`h-5 w-5 ${k.color}`} />
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        {/* Graphique CA */}
        <Card className="xl:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-slate-700 flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-brand-600" /> Chiffre d'affaires (30j)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {dash && dash.revenue_by_day.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={dash.revenue_by_day} margin={{ top: 4, right: 10, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} tickFormatter={(v) => `${(v/1000).toFixed(0)}k`} />
                  <Tooltip contentStyle={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 8, fontSize: 12 }} formatter={(v: number) => [formatCurrency(v), "CA"]} />
                  <Line type="monotone" dataKey="revenue" stroke="#16a34a" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[200px] flex items-center justify-center">
                {isLoading ? <Skeleton className="h-full w-full" /> : <p className="text-sm text-slate-400">Aucune donnée</p>}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Stock alerts */}
        <Card className="border-red-100">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-slate-700 flex items-center gap-2">
              <Package className="h-4 w-4 text-red-500" /> Stock faible
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {!alerts ? (
              Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-8 w-full" />)
            ) : alerts.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-4">Tout le stock est OK ✓</p>
            ) : (
              alerts.slice(0, 6).map((item, i) => (
                <div key={i} className="flex items-center justify-between rounded-lg bg-red-50 px-3 py-2">
                  <span className="text-sm text-slate-700 truncate">{item.products?.name_fr}</span>
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${item.stock_qty === 0 ? "bg-red-200 text-red-800" : "bg-yellow-100 text-yellow-800"}`}>
                    {item.stock_qty === 0 ? "Rupture" : `${item.stock_qty} restant`}
                  </span>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      {/* Stats période */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        {[
          { label: "CA période (30j)", value: dash ? formatCurrency(dash.period.revenue) : "—" },
          { label: "Total commandes", value: dash ? String(dash.period.orders) : "—" },
          { label: "Livrées", value: dash ? String(dash.period.delivered) : "—" },
          { label: "Taux de conversion", value: dash ? `${dash.period.conversion_rate}%` : "—" },
        ].map((s) => (
          <Card key={s.label}>
            <CardContent className="p-4">
              <p className="text-xs text-slate-500 uppercase tracking-wider">{s.label}</p>
              {isLoading ? <Skeleton className="mt-1 h-7 w-16" /> : (
                <p className="mt-1 text-2xl font-bold text-slate-800">{s.value}</p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
