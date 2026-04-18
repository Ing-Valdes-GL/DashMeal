"use client";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { apiGet } from "@/lib/api";
import { formatCurrency } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell,
} from "recharts";
import {
  Building2, Users, ShoppingBag, DollarSign, TrendingUp,
  FileText, Globe, RefreshCw,
} from "lucide-react";

interface PlatformStats {
  brands: { total: number; active: number; suspended: number };
  users: { total: number; verified: number };
  orders: { total: number; today: number; delivering: number };
  revenue: { gmv_total: number; gmv_online: number; gmv_inperson: number };
  commissions: { total: number; pending: number; settled: number };
  applications: { pending: number; approved: number; rejected: number };
  gmv_by_day?: { date: string; gmv: number; orders: number }[];
  top_brands?: { name: string; revenue: number; orders: number }[];
}

const COLORS = ["#f97316", "#3b82f6", "#22c55e", "#a855f7", "#ec4899"];

export default function PlatformPage() {
  const t = useTranslations("platform");

  const { data, isLoading, refetch } = useQuery<PlatformStats>({
    queryKey: ["platform-stats"],
    queryFn: () => apiGet("/analytics/platform"),
  });

  // Provide default values for all nested properties
  const defaultData: PlatformStats = {
    brands: { total: 0, active: 0, suspended: 0 },
    users: { total: 0, verified: 0 },
    orders: { total: 0, today: 0, delivering: 0 },
    revenue: { gmv_total: 0, gmv_online: 0, gmv_inperson: 0 },
    commissions: { total: 0, pending: 0, settled: 0 },
    applications: { pending: 0, approved: 0, rejected: 0 },
    gmv_by_day: [],
    top_brands: [],
  };

  const stats = data || defaultData;

  const kpis = [
    {
      label: t("totalBrands"),
      value: stats.brands?.total ?? 0,
      sub: `${stats.brands?.active ?? 0} actives`,
      icon: Building2,
      color: "text-brand-400",
      bg: "bg-brand-500/10",
    },
    {
      label: t("totalUsers"),
      value: stats.users?.total ?? 0,
      sub: `${stats.users?.verified ?? 0} vérifiés`,
      icon: Users,
      color: "text-blue-400",
      bg: "bg-blue-500/10",
    },
    {
      label: t("totalOrders"),
      value: stats.orders?.total ?? 0,
      sub: `${stats.orders?.today ?? 0} aujourd'hui`,
      icon: ShoppingBag,
      color: "text-green-400",
      bg: "bg-green-500/10",
    },
    {
      label: t("totalRevenue"),
      value: formatCurrency(stats.revenue?.gmv_total ?? 0),
      sub: "Volume total transactions",
      icon: DollarSign,
      color: "text-purple-400",
      bg: "bg-purple-500/10",
    },
    {
      label: t("totalCommissions"),
      value: formatCurrency(stats.commissions?.total ?? 0),
      sub: `${formatCurrency(stats.commissions?.pending ?? 0)} en attente`,
      icon: TrendingUp,
      color: "text-amber-400",
      bg: "bg-amber-500/10",
    },
    {
      label: t("pendingApplications"),
      value: stats.applications?.pending ?? 0,
      sub: `${stats.applications?.approved ?? 0} approuvées`,
      icon: FileText,
      color: "text-red-400",
      bg: "bg-red-500/10",
    },
  ];

  const gmvData = (stats.gmv_by_day ?? []).map((d) => ({
    date: new Date(d.date).toLocaleDateString("fr-FR", { month: "short", day: "numeric" }),
    GMV: d.gmv,
    Commandes: d.orders,
  }));

  const gmvByType = [
    { name: "En ligne (2%)", value: stats.revenue?.gmv_online ?? 0 },
    { name: "Présentiel (1.5%)", value: stats.revenue?.gmv_inperson ?? 0 },
  ];

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Globe className="h-6 w-6 text-brand-400" />
            {t("title")}
          </h1>
          <p className="text-sm text-slate-400">{t("subtitle")}</p>
        </div>
        <Button variant="ghost" size="sm" onClick={() => refetch()}>
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      {/* KPI grid */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
        {kpis.map((k) => {
          const Icon = k.icon;
          return (
            <Card key={k.label}>
              <CardContent className="p-4">
                {isLoading ? (
                  <Skeleton className="h-16 w-full" />
                ) : (
                  <>
                    <div className={`h-9 w-9 rounded-lg flex items-center justify-center mb-3 ${k.bg}`}>
                      <Icon className={`h-4 w-4 ${k.color}`} />
                    </div>
                    <p className="text-xl font-bold text-slate-900">{k.value}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{k.label}</p>
                    <p className="text-xs text-slate-600 mt-0.5">{k.sub}</p>
                  </>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        {/* GMV chart */}
        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Volume de transactions (GMV) — 30 jours</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-56 w-full" />
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <AreaChart data={gmvData}>
                  <defs>
                    <linearGradient id="gmvGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f97316" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#f97316" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="date" tick={{ fill: "#64748b", fontSize: 11 }} tickLine={false} />
                  <YAxis tick={{ fill: "#64748b", fontSize: 11 }} tickLine={false} axisLine={false}
                    tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                  <Tooltip
                    contentStyle={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 8 }}
                    formatter={(v: number, name: string) =>
                      name === "GMV" ? [formatCurrency(v), "GMV"] : [v, "Commandes"]
                    }
                  />
                  <Area type="monotone" dataKey="GMV" stroke="#f97316" strokeWidth={2}
                    fill="url(#gmvGrad)" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* GMV by type */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Répartition GMV</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-56 w-full" />
            ) : (
              <>
                <ResponsiveContainer width="100%" height={180}>
                  <PieChart>
                    <Pie data={gmvByType} dataKey="value" nameKey="name"
                      cx="50%" cy="50%" innerRadius={50} outerRadius={75}
                      paddingAngle={4}
                    >
                      {gmvByType.map((_, i) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 8 }}
                      formatter={(v: number) => [formatCurrency(v)]}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-2 mt-2">
                  {gmvByType.map((item, i) => (
                    <div key={item.name} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <div className="h-2.5 w-2.5 rounded-full" style={{ background: COLORS[i] }} />
                        <span className="text-slate-400">{item.name}</span>
                      </div>
                      <span className="text-slate-900 font-medium">{formatCurrency(item.value)}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Top brands */}
      {stats.top_brands && stats.top_brands.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Top marques par volume</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={stats.top_brands.slice(0, 8)}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="name" tick={{ fill: "#64748b", fontSize: 11 }} tickLine={false} />
                <YAxis tick={{ fill: "#64748b", fontSize: 11 }} tickLine={false} axisLine={false}
                  tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                <Tooltip
                  contentStyle={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 8 }}
                  formatter={(v: number, name: string) =>
                    name === "revenue" ? [formatCurrency(v), "CA"] : [v, "Commandes"]
                  }
                />
                <Bar dataKey="revenue" name="revenue" fill="#f97316" radius={[4, 4, 0, 0]} />
                <Bar dataKey="orders" name="orders" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Quick stats footer */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-brand-400">
              {isLoading ? "—" : `${((data?.commissions?.total ?? 0) / Math.max(data?.revenue?.gmv_total ?? 1, 1) * 100).toFixed(1)}%`}
            </p>
            <p className="text-xs text-slate-500 mt-1">Taux commission effectif</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-blue-400">
              {isLoading ? "—" : data?.orders.delivering ?? 0}
            </p>
            <p className="text-xs text-slate-500 mt-1">Livraisons en cours</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-green-400">
              {isLoading ? "—" : data?.brands.active ?? 0}
            </p>
            <p className="text-xs text-slate-500 mt-1">Marques actives</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-amber-400">
              {isLoading ? "—" : data?.applications.pending ?? 0}
            </p>
            <p className="text-xs text-slate-500 mt-1">Dossiers en attente</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
