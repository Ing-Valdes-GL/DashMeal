"use client";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { apiGet } from "@/lib/api";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  TrendingUp, ShoppingCart, DollarSign,
  Clock, AlertTriangle, ArrowRight,
} from "lucide-react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import Link from "next/link";
import { use } from "react";

interface DashboardData {
  period_days: number;
  pending_orders: number;
  today: {
    revenue: number;
    orders: number;
    avg_order: number;
    out_of_stock: number;
  };
  period: {
    revenue: number;
    orders: number;
    delivered: number;
    avg_order: number;
    conversion_rate: number;
  };
  revenue_by_day: { date: string; revenue: number; orders: number }[];
  top_products: { name: string; revenue: number; quantity: number }[];
  orders_by_status: { status: string; count: number }[];
  orders_by_type: { type: string; count: number }[];
  orders_by_payment: { method: string; count: number }[];
}

interface RecentOrder {
  id: string; total: number; status: string; type: string; created_at: string;
  users: { name: string }; branches: { name: string };
}

const STATUS_VARIANT: Record<string, string> = {
  pending: "pending", confirmed: "confirmed", preparing: "preparing",
  ready: "ready", delivering: "delivering", delivered: "delivered", cancelled: "cancelled",
};

export default function DashboardPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = use(params);
  const t = useTranslations("dashboard");
  const tOrders = useTranslations("orders");

  const { data: dash, isLoading: loadingStats } = useQuery<DashboardData>({
    queryKey: ["dashboard"],
    queryFn: () => apiGet("/analytics/dashboard"),
  });

  const { data: recentOrders } = useQuery<{ data: RecentOrder[] }>({
    queryKey: ["orders", "recent"],
    queryFn: () => apiGet("/orders", { limit: 8, page: 1 }) as Promise<{ data: RecentOrder[] }>,
  });

  const statCards = [
    {
      label: t("todayRevenue"), icon: DollarSign, color: "text-brand-600",
      bg: "bg-brand-50 border-brand-100",
      value: dash ? formatCurrency(dash.today.revenue) : "—",
      sub: t("vsLastWeek"), trend: "up" as const,
    },
    {
      label: t("todayOrders"), icon: ShoppingCart, color: "text-blue-600",
      bg: "bg-blue-50 border-blue-100",
      value: dash ? String(dash.today.orders) : "—",
      sub: t("vsLastWeek"), trend: "up" as const,
    },
    {
      label: t("pendingOrders"), icon: Clock, color: "text-yellow-600",
      bg: "bg-yellow-50 border-yellow-100",
      value: dash ? String(dash.pending_orders) : "—",
      urgent: (dash?.pending_orders ?? 0) > 5,
    },
    {
      label: t("outOfStock"), icon: AlertTriangle, color: "text-red-600",
      bg: "bg-red-50 border-red-100",
      value: dash ? String(dash.today.out_of_stock) : "—",
      urgent: (dash?.today.out_of_stock ?? 0) > 0,
    },
  ];

  const topProducts = dash?.top_products ?? [];
  const maxQty = topProducts[0]?.quantity || 1;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* En-tête */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">{t("title")}</h1>
        <p className="text-sm text-slate-500 mt-0.5">{t("subtitle")}</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {statCards.map((card) => {
          const Icon = card.icon;
          return (
            <Card key={card.label} className={`border ${card.bg}`}>
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">{card.label}</p>
                    {loadingStats ? (
                      <Skeleton className="mt-2 h-8 w-24" />
                    ) : (
                      <p className="mt-1.5 text-3xl font-bold text-slate-900">{card.value}</p>
                    )}
                    {card.sub && (
                      <div className="mt-1 flex items-center gap-1 text-xs text-slate-400">
                        <TrendingUp className="h-3 w-3 text-green-600" />
                        {card.sub}
                      </div>
                    )}
                    {card.urgent && (
                      <p className="mt-1 text-xs text-red-600 font-medium">Attention requise</p>
                    )}
                  </div>
                  <div className={`rounded-xl p-2.5 ${card.bg} border`}>
                    <Icon className={`h-5 w-5 ${card.color}`} />
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        {/* Graphique CA */}
        <Card className="xl:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-slate-700">{t("revenueChart")}</CardTitle>
          </CardHeader>
          <CardContent>
            {dash && dash.revenue_by_day.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={dash.revenue_by_day} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false}
                    tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                  <Tooltip
                    contentStyle={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 8, fontSize: 12 }}
                    labelStyle={{ color: "#64748b" }}
                    formatter={(v: number) => [formatCurrency(v), "CA"]}
                  />
                  <Line type="monotone" dataKey="revenue" stroke="#16a34a" strokeWidth={2}
                    dot={false} activeDot={{ r: 4, fill: "#16a34a" }} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[220px] flex items-center justify-center">
                {loadingStats ? (
                  <Skeleton className="h-full w-full" />
                ) : (
                  <p className="text-sm text-slate-400">Aucune donnée pour la période</p>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Top produits */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-slate-700">{t("topProducts")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {loadingStats ? (
              Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-8 w-full" />
              ))
            ) : topProducts.length > 0 ? (
              topProducts.slice(0, 5).map((p, i) => (
                <div key={`${p.name}-${i}`} className="flex items-center gap-3">
                  <span className="text-xs font-bold text-slate-400 w-4">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-slate-800 truncate font-medium">{p.name}</p>
                    <div className="mt-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-brand-500 rounded-full"
                        style={{ width: `${(p.quantity / maxQty) * 100}%` }}
                      />
                    </div>
                  </div>
                  <span className="text-xs text-slate-500 shrink-0">{p.quantity}</span>
                </div>
              ))
            ) : (
              <p className="text-sm text-slate-400 text-center py-4">Aucune vente sur la période</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Commandes récentes */}
      <Card>
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <CardTitle className="text-sm font-semibold text-slate-700">{t("recentOrders")}</CardTitle>
          <Link href={`/${locale}/orders`}>
            <Button variant="ghost" size="sm" className="text-brand-600 gap-1 hover:text-brand-700">
              {t("seeAll")} <ArrowRight className="h-3 w-3" />
            </Button>
          </Link>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  {["Client", "Agence", "Type", "Statut", "Total", "Date"].map((h) => (
                    <th key={h} className="px-4 py-2.5 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {recentOrders?.data ? (
                  recentOrders.data.map((order) => (
                    <tr key={order.id} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3 text-slate-900 font-medium">{order.users?.name}</td>
                      <td className="px-4 py-3 text-slate-500">{order.branches?.name}</td>
                      <td className="px-4 py-3">
                        <Badge variant={order.type === "collect" ? "collect" : "delivery"}>
                          {order.type === "collect" ? tOrders("collect") : tOrders("delivery")}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={STATUS_VARIANT[order.status] as any}>
                          {tOrders(order.status as any)}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-slate-900 font-semibold">{formatCurrency(order.total)}</td>
                      <td className="px-4 py-3 text-slate-400 text-xs">{formatDateTime(order.created_at)}</td>
                    </tr>
                  ))
                ) : (
                  Array.from({ length: 6 }).map((_, i) => (
                    <tr key={i}>
                      {Array.from({ length: 6 }).map((_, j) => (
                        <td key={j} className="px-4 py-3"><Skeleton className="h-5 w-full" /></td>
                      ))}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
