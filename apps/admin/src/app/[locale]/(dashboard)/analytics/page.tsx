"use client";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { apiGet, apiPost } from "@/lib/api";
import { formatCurrency } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import { TrendingUp, ShoppingBag, DollarSign, Package, Download } from "lucide-react";

const COLORS = ["#f97316", "#3b82f6", "#22c55e", "#a855f7", "#ec4899", "#14b8a6"];

interface DashboardAnalytics {
  today: { revenue: number; orders: number; avg_order: number; out_of_stock: number };
  revenue_by_day: { date: string; revenue: number; orders: number }[];
  top_products: { name: string; revenue: number; quantity: number }[];
  orders_by_status: { status: string; count: number }[];
  orders_by_type: { type: string; count: number }[];
}

interface BranchAnalytics {
  branch_id: string;
  branch_name: string;
  revenue: number;
  orders: number;
}

export default function AnalyticsPage() {
  const t = useTranslations("analytics");
  const [period, setPeriod] = useState("30");
  const [tab, setTab] = useState("overview");

  const { data, isLoading } = useQuery<DashboardAnalytics>({
    queryKey: ["analytics-dashboard", period],
    queryFn: () => apiGet("/analytics/dashboard", { days: period }),
  });

  const { data: branchData } = useQuery<BranchAnalytics[]>({
    queryKey: ["analytics-branches", period],
    queryFn: () => apiGet("/analytics/branches", { days: period }),
    enabled: tab === "branches",
  });

  const stats = [
    {
      label: t("revenue"),
      value: formatCurrency(data?.today?.revenue ?? 0),
      icon: DollarSign,
      color: "text-brand-400",
      bg: "bg-brand-500/10",
    },
    {
      label: t("orders"),
      value: data?.today?.orders ?? 0,
      icon: ShoppingBag,
      color: "text-blue-400",
      bg: "bg-blue-500/10",
    },
    {
      label: t("avgOrder"),
      value: formatCurrency(data?.today?.avg_order ?? 0),
      icon: TrendingUp,
      color: "text-green-400",
      bg: "bg-green-500/10",
    },
    {
      label: "Ruptures",
      value: data?.today?.out_of_stock ?? 0,
      icon: Package,
      color: "text-red-400",
      bg: "bg-red-500/10",
    },
  ];

  const chartData = (data?.revenue_by_day ?? []).map((d) => ({
    date: new Date(d.date).toLocaleDateString("fr-FR", { month: "short", day: "numeric" }),
    CA: d.revenue,
    Commandes: d.orders,
  }));

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">{t("title")}</h1>
          <p className="text-sm text-slate-400">{t("subtitle")}</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">7 derniers jours</SelectItem>
              <SelectItem value="30">30 derniers jours</SelectItem>
              <SelectItem value="90">90 derniers jours</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm">
            <Download className="h-4 w-4 mr-1.5" /> Export
          </Button>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {stats.map((s) => {
          const Icon = s.icon;
          return (
            <Card key={s.label}>
              <CardContent className="p-5">
                {isLoading ? (
                  <Skeleton className="h-16 w-full" />
                ) : (
                  <div className="flex items-center gap-3">
                    <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${s.bg}`}>
                      <Icon className={`h-5 w-5 ${s.color}`} />
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">{s.label}</p>
                      <p className="text-xl font-bold text-white">{s.value}</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Tabs */}
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="overview">Vue générale</TabsTrigger>
          <TabsTrigger value="products">{t("topProducts")}</TabsTrigger>
          <TabsTrigger value="branches">{t("byBranch")}</TabsTrigger>
        </TabsList>
      </Tabs>

      {tab === "overview" && (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
          {/* Revenue chart — spans 2 cols */}
          <Card className="xl:col-span-2">
            <CardHeader>
              <CardTitle className="text-base">{t("revenueEvolution")}</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-64 w-full" />
              ) : (
                <ResponsiveContainer width="100%" height={260}>
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis dataKey="date" tick={{ fill: "#64748b", fontSize: 11 }} tickLine={false} />
                    <YAxis tick={{ fill: "#64748b", fontSize: 11 }} tickLine={false} axisLine={false}
                      tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                    <Tooltip
                      contentStyle={{ background: "#0f172a", border: "1px solid #1e293b", borderRadius: 8 }}
                      labelStyle={{ color: "#94a3b8" }}
                      formatter={(v: number, name: string) =>
                        name === "CA" ? [formatCurrency(v), "CA"] : [v, "Commandes"]
                      }
                    />
                    <Legend />
                    <Line type="monotone" dataKey="CA" stroke="#f97316" strokeWidth={2}
                      dot={false} activeDot={{ r: 4, fill: "#f97316" }} />
                    <Line type="monotone" dataKey="Commandes" stroke="#3b82f6" strokeWidth={2}
                      dot={false} activeDot={{ r: 4, fill: "#3b82f6" }} />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* Orders by type */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Répartition par type</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-64 w-full" />
              ) : (
                <ResponsiveContainer width="100%" height={260}>
                  <PieChart>
                    <Pie
                      data={data?.orders_by_type ?? []}
                      dataKey="count"
                      nameKey="type"
                      cx="50%" cy="50%"
                      outerRadius={90}
                      label={({ type, percent }) =>
                        `${type === "collect" ? "Collect" : "Livraison"} ${(percent * 100).toFixed(0)}%`
                      }
                      labelLine={false}
                    >
                      {(data?.orders_by_type ?? []).map((_, i) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ background: "#0f172a", border: "1px solid #1e293b", borderRadius: 8 }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {tab === "products" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("topProducts")}</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-80 w-full" />
            ) : (
              <ResponsiveContainer width="100%" height={400}>
                <BarChart
                  data={(data?.top_products ?? []).slice(0, 10)}
                  layout="vertical"
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" horizontal={false} />
                  <XAxis type="number" tick={{ fill: "#64748b", fontSize: 11 }} tickLine={false}
                    tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                  <YAxis type="category" dataKey="name" tick={{ fill: "#94a3b8", fontSize: 12 }}
                    tickLine={false} axisLine={false} width={160} />
                  <Tooltip
                    contentStyle={{ background: "#0f172a", border: "1px solid #1e293b", borderRadius: 8 }}
                    formatter={(v: number) => [formatCurrency(v), "CA"]}
                  />
                  <Bar dataKey="revenue" fill="#f97316" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      )}

      {tab === "branches" && (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t("byBranch")} — CA</CardTitle>
            </CardHeader>
            <CardContent>
              {!branchData ? (
                <Skeleton className="h-64 w-full" />
              ) : (
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={branchData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis dataKey="branch_name" tick={{ fill: "#64748b", fontSize: 11 }} tickLine={false} />
                    <YAxis tick={{ fill: "#64748b", fontSize: 11 }} tickLine={false} axisLine={false}
                      tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                    <Tooltip
                      contentStyle={{ background: "#0f172a", border: "1px solid #1e293b", borderRadius: 8 }}
                      formatter={(v: number) => [formatCurrency(v), "CA"]}
                    />
                    <Bar dataKey="revenue" fill="#f97316" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t("byBranch")} — Commandes</CardTitle>
            </CardHeader>
            <CardContent>
              {!branchData ? (
                <Skeleton className="h-64 w-full" />
              ) : (
                <div className="space-y-3">
                  {branchData.map((b, i) => {
                    const max = Math.max(...branchData.map((x) => x.orders), 1);
                    return (
                      <div key={b.branch_id}>
                        <div className="flex items-center justify-between text-sm mb-1">
                          <span className="text-white font-medium">{b.branch_name}</span>
                          <span className="text-slate-400">{b.orders} commandes</span>
                        </div>
                        <div className="h-2 rounded-full bg-surface-700">
                          <div
                            className="h-2 rounded-full bg-brand-500 transition-all duration-500"
                            style={{ width: `${(b.orders / max) * 100}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
