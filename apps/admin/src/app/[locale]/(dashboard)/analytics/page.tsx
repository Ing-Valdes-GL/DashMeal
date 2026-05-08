"use client";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiGet } from "@/lib/api";
import { formatCurrency } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import {
  TrendingUp, ShoppingBag, DollarSign, PercentCircle,
  CheckCircle2, AlertCircle, RefreshCw, Download,
} from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

const COLORS = ["#f97316", "#3b82f6", "#22c55e", "#a855f7", "#ec4899", "#14b8a6", "#f59e0b", "#06b6d4"];

const STATUS_LABELS: Record<string, string> = {
  pending: "En attente", confirmed: "Confirmée", preparing: "En préparation",
  ready: "Prête", delivering: "En livraison", delivered: "Livrée", cancelled: "Annulée",
};

interface DashboardAnalytics {
  period_days: number;
  today: { revenue: number; orders: number; avg_order: number; out_of_stock: number };
  period: { revenue: number; orders: number; delivered: number; avg_order: number; conversion_rate: number };
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
  delivered: number;
}

export default function AnalyticsPage() {
  const [period, setPeriod] = useState("30");

  const { data, isLoading, refetch } = useQuery<DashboardAnalytics>({
    queryKey: ["analytics-dashboard", period],
    queryFn: () => apiGet("/analytics/dashboard", { days: period }),
    staleTime: 60_000,
  });

  const { data: branchData, isLoading: branchLoading } = useQuery<BranchAnalytics[]>({
    queryKey: ["analytics-branches", period],
    queryFn: () => apiGet("/analytics/branches", { days: period }),
    staleTime: 60_000,
  });

  const chartData = (data?.revenue_by_day ?? []).map((d) => ({
    date: new Date(d.date).toLocaleDateString("fr-FR", { month: "short", day: "numeric" }),
    CA: d.revenue,
    Commandes: d.orders,
  }));

  const statusData = (data?.orders_by_status ?? []).map((s) => ({
    name: STATUS_LABELS[s.status] ?? s.status,
    value: s.count,
  }));

  const typeData = (data?.orders_by_type ?? []).map((t) => ({
    name: t.type === "collect" ? "Retrait" : "Livraison",
    value: t.count,
  }));

  const branchBarData = (branchData ?? []).map((b) => ({
    name: b.branch_name,
    CA: b.revenue,
    Commandes: b.orders,
    Livrées: b.delivered,
  }));

  function exportPDF() {
    const doc = new jsPDF();
    const now = new Date().toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });
    doc.setFontSize(18);
    doc.setTextColor(249, 115, 22);
    doc.text("Dash Meal — Rapport Analytique", 14, 20);
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Période : ${period} derniers jours — Généré le ${now}`, 14, 27);

    autoTable(doc, {
      startY: 34,
      head: [["Indicateur", "Valeur"]],
      body: [
        ["CA période", formatCurrency(data?.period.revenue ?? 0)],
        ["Commandes totales", String(data?.period.orders ?? 0)],
        ["Panier moyen", formatCurrency(data?.period.avg_order ?? 0)],
        ["Taux de conversion", `${data?.period.conversion_rate ?? 0}%`],
        ["Commandes livrées", String(data?.period.delivered ?? 0)],
      ],
      styles: { fontSize: 9 },
      headStyles: { fillColor: [249, 115, 22] },
    });

    const y1 = (doc as any).lastAutoTable.finalY + 8;
    if ((data?.top_products ?? []).length > 0) {
      doc.setFontSize(12);
      doc.setTextColor(30);
      doc.text("Top 10 produits", 14, y1);
      autoTable(doc, {
        startY: y1 + 4,
        head: [["Produit", "Qté vendue", "CA"]],
        body: (data?.top_products ?? []).slice(0, 10).map((p) => [p.name, String(p.quantity), formatCurrency(p.revenue)]),
        styles: { fontSize: 9 },
        headStyles: { fillColor: [249, 115, 22] },
      });
    }

    doc.save(`analytics-${period}j-${new Date().toISOString().slice(0, 10)}.pdf`);
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Analytiques avancés</h1>
          <p className="text-sm text-slate-400">Vue détaillée de vos performances commerciales.</p>
        </div>
        <div className="flex items-center gap-2">
          {/* Period tabs */}
          <Tabs value={period} onValueChange={setPeriod}>
            <TabsList>
              <TabsTrigger value="7">7j</TabsTrigger>
              <TabsTrigger value="30">30j</TabsTrigger>
              <TabsTrigger value="90">90j</TabsTrigger>
            </TabsList>
          </Tabs>
          <Button variant="ghost" size="sm" onClick={() => refetch()} className="text-slate-400">
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
          <Button variant="outline" size="sm" onClick={exportPDF} disabled={isLoading} className="gap-1.5">
            <Download className="h-3.5 w-3.5" /> PDF
          </Button>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          {
            label: `CA (${period}j)`,
            value: isLoading ? null : formatCurrency(data?.period.revenue ?? 0),
            icon: DollarSign, color: "text-brand-400", bg: "bg-brand-500/10",
          },
          {
            label: "Commandes totales",
            value: isLoading ? null : String(data?.period.orders ?? 0),
            icon: ShoppingBag, color: "text-blue-400", bg: "bg-blue-500/10",
          },
          {
            label: "Panier moyen",
            value: isLoading ? null : formatCurrency(data?.period.avg_order ?? 0),
            icon: TrendingUp, color: "text-purple-400", bg: "bg-purple-500/10",
          },
          {
            label: "Taux de conversion",
            value: isLoading ? null : `${data?.period.conversion_rate ?? 0}%`,
            icon: PercentCircle, color: "text-green-400", bg: "bg-green-500/10",
          },
        ].map((card) => {
          const Icon = card.icon;
          return (
            <Card key={card.label}>
              <CardContent className="p-5">
                {isLoading ? (
                  <Skeleton className="h-14 w-full" />
                ) : (
                  <div className="flex items-center gap-3">
                    <div className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ${card.bg}`}>
                      <Icon className={`h-5 w-5 ${card.color}`} />
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">{card.label}</p>
                      <p className="text-xl font-bold text-slate-900">{card.value}</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* LineChart: CA par jour */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Évolution du CA — {period} derniers jours</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-64 w-full" />
          ) : chartData.length === 0 ? (
            <div className="flex items-center justify-center h-64 text-slate-400 gap-2">
              <AlertCircle className="h-4 w-4" /> Aucune donnée sur cette période
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="date" tick={{ fill: "#64748b", fontSize: 11 }} tickLine={false} />
                <YAxis
                  tick={{ fill: "#64748b", fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}
                />
                <Tooltip
                  contentStyle={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 8 }}
                  formatter={(v: number, name: string) =>
                    name === "CA" ? [formatCurrency(v), "CA"] : [v, "Commandes"]
                  }
                />
                <Legend />
                <Line type="monotone" dataKey="CA" stroke="#f97316" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                <Line type="monotone" dataKey="Commandes" stroke="#3b82f6" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* BarChart: CA par agence */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">CA par agence</CardTitle>
        </CardHeader>
        <CardContent>
          {branchLoading ? (
            <Skeleton className="h-64 w-full" />
          ) : !branchBarData.length ? (
            <div className="flex items-center justify-center h-64 text-slate-400 gap-2">
              <AlertCircle className="h-4 w-4" /> Aucune donnée
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={branchBarData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
                <XAxis
                  type="number"
                  tick={{ fill: "#64748b", fontSize: 11 }}
                  tickLine={false}
                  tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  tick={{ fill: "#94a3b8", fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                  width={120}
                />
                <Tooltip
                  contentStyle={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 8 }}
                  formatter={(v: number) => [formatCurrency(v), "CA"]}
                />
                <Bar dataKey="CA" fill="#f97316" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* PieCharts row */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {/* PieChart: commandes par statut */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Commandes par statut</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-52 w-full" />
            ) : statusData.length === 0 ? (
              <div className="flex items-center justify-center h-52 text-slate-400 gap-2">
                <AlertCircle className="h-4 w-4" /> Aucune donnée
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie
                    data={statusData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    labelLine={false}
                  >
                    {statusData.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 8 }}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* PieChart: online vs présentiel */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Retrait vs Livraison</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-52 w-full" />
            ) : typeData.length === 0 ? (
              <div className="flex items-center justify-center h-52 text-slate-400 gap-2">
                <AlertCircle className="h-4 w-4" /> Aucune donnée
              </div>
            ) : (
              <div className="flex flex-col items-center">
                <ResponsiveContainer width="100%" height={180}>
                  <PieChart>
                    <Pie
                      data={typeData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={80}
                    >
                      {typeData.map((_, i) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 8 }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex gap-4 mt-2">
                  {typeData.map((item, i) => (
                    <div key={item.name} className="flex items-center gap-1.5 text-sm">
                      <div className="h-3 w-3 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                      <span className="text-slate-600">{item.name}</span>
                      <span className="font-semibold text-slate-900">({item.value})</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Top 10 products table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Top 10 produits</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : !data?.top_products?.length ? (
            <div className="flex items-center justify-center py-12 text-slate-400 gap-2">
              <AlertCircle className="h-4 w-4" /> Aucun produit vendu sur cette période
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="text-left px-4 py-3 text-xs text-slate-500 font-semibold uppercase tracking-wide">#</th>
                    <th className="text-left px-4 py-3 text-xs text-slate-500 font-semibold uppercase tracking-wide">Produit</th>
                    <th className="text-right px-4 py-3 text-xs text-slate-500 font-semibold uppercase tracking-wide">Qté vendue</th>
                    <th className="text-right px-4 py-3 text-xs text-slate-500 font-semibold uppercase tracking-wide">CA généré</th>
                  </tr>
                </thead>
                <tbody>
                  {(data?.top_products ?? []).slice(0, 10).map((p, i) => {
                    const maxRev = data.top_products[0]?.revenue ?? 1;
                    return (
                      <tr key={i} className="border-b border-slate-100 hover:bg-slate-50">
                        <td className="px-4 py-3">
                          {i === 0 ? (
                            <Badge variant="outline" className="border-yellow-500/30 bg-yellow-500/10 text-yellow-500 text-xs w-7 justify-center">1</Badge>
                          ) : i === 1 ? (
                            <Badge variant="outline" className="border-slate-400/30 bg-slate-400/10 text-slate-400 text-xs w-7 justify-center">2</Badge>
                          ) : i === 2 ? (
                            <Badge variant="outline" className="border-orange-500/30 bg-orange-500/10 text-orange-500 text-xs w-7 justify-center">3</Badge>
                          ) : (
                            <span className="text-slate-400 w-7 inline-block text-center">{i + 1}</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <p className="font-medium text-slate-900">{p.name}</p>
                          <div className="mt-1 h-1.5 w-full max-w-[200px] rounded-full bg-slate-100">
                            <div
                              className="h-1.5 rounded-full bg-brand-500"
                              style={{ width: `${(p.revenue / maxRev) * 100}%` }}
                            />
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <ShoppingBag className="h-3.5 w-3.5 text-slate-400" />
                            <span className="font-semibold text-slate-900">{p.quantity}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right font-bold text-brand-500">
                          {formatCurrency(p.revenue)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Delivered stats */}
      {!isLoading && data && (
        <div className="grid grid-cols-2 gap-4">
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-green-500/10 flex items-center justify-center">
                <CheckCircle2 className="h-5 w-5 text-green-500" />
              </div>
              <div>
                <p className="text-xs text-slate-400">Commandes livrées</p>
                <p className="text-xl font-bold text-green-500">{data.period.delivered}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-red-500/10 flex items-center justify-center">
                <AlertCircle className="h-5 w-5 text-red-400" />
              </div>
              <div>
                <p className="text-xs text-slate-400">Ruptures de stock</p>
                <p className="text-xl font-bold text-red-400">{data.today.out_of_stock}</p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
