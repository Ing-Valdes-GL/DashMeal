"use client";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { apiGet } from "@/lib/api";
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
import {
  TrendingUp, ShoppingBag, DollarSign, Package, Download,
  PercentCircle, CheckCircle2, AlertCircle,
} from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

const COLORS = ["#f97316", "#3b82f6", "#22c55e", "#a855f7", "#ec4899", "#14b8a6", "#f59e0b", "#06b6d4"];

const STATUS_LABELS: Record<string, string> = {
  pending: "En attente",
  confirmed: "Confirmée",
  preparing: "En préparation",
  ready: "Prête",
  delivering: "En livraison",
  delivered: "Livrée",
  cancelled: "Annulée",
};

const PAYMENT_LABELS: Record<string, string> = {
  online: "En ligne",
  cash: "Espèces",
  unknown: "Non renseigné",
};

interface DashboardAnalytics {
  period_days: number;
  today: { revenue: number; orders: number; avg_order: number; out_of_stock: number };
  period: { revenue: number; orders: number; delivered: number; avg_order: number; conversion_rate: number };
  revenue_by_day: { date: string; revenue: number; orders: number }[];
  top_products: { name: string; revenue: number; quantity: number }[];
  orders_by_status: { status: string; count: number }[];
  orders_by_type: { type: string; count: number }[];
  orders_by_payment: { method: string; count: number }[];
}

interface BranchAnalytics {
  branch_id: string;
  branch_name: string;
  revenue: number;
  orders: number;
  delivered: number;
}

export default function AnalyticsPage() {
  const t = useTranslations("analytics");
  const [period, setPeriod] = useState("30");
  const [tab, setTab] = useState("overview");

  const { data, isLoading } = useQuery<DashboardAnalytics>({
    queryKey: ["analytics-dashboard", period],
    queryFn: () => apiGet("/analytics/dashboard", { days: period }),
  });

  const { data: branchData, isLoading: branchLoading } = useQuery<BranchAnalytics[]>({
    queryKey: ["analytics-branches", period],
    queryFn: () => apiGet("/analytics/branches", { days: period }),
    enabled: tab === "branches",
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

  const paymentData = (data?.orders_by_payment ?? []).map((p) => ({
    name: PAYMENT_LABELS[p.method] ?? p.method,
    value: p.count,
  }));

  const exportPDF = () => {
    const doc = new jsPDF();
    const periodLabel = `${period} derniers jours`;
    const now = new Date().toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });

    // En-tête
    doc.setFontSize(20);
    doc.setTextColor(249, 115, 22);
    doc.text("Dash Meal — Rapport Analytique", 14, 20);
    doc.setFontSize(11);
    doc.setTextColor(100);
    doc.text(`Période : ${periodLabel} — Généré le ${now}`, 14, 28);

    // Résumé de la période
    doc.setFontSize(13);
    doc.setTextColor(30);
    doc.text("Résumé de la période", 14, 42);

    autoTable(doc, {
      startY: 46,
      head: [["Indicateur", "Valeur"]],
      body: [
        ["Chiffre d'affaires", formatCurrency(data?.period.revenue ?? 0)],
        ["Commandes totales", String(data?.period.orders ?? 0)],
        ["Commandes livrées", String(data?.period.delivered ?? 0)],
        ["Panier moyen", formatCurrency(data?.period.avg_order ?? 0)],
        ["Taux de conversion", `${data?.period.conversion_rate ?? 0}%`],
        ["Ruptures de stock", String(data?.today.out_of_stock ?? 0)],
      ],
      styles: { fontSize: 10 },
      headStyles: { fillColor: [249, 115, 22] },
      alternateRowStyles: { fillColor: [248, 248, 248] },
    });

    const y1 = (doc as any).lastAutoTable.finalY + 10;

    // Top produits
    if ((data?.top_products ?? []).length > 0) {
      doc.setFontSize(13);
      doc.setTextColor(30);
      doc.text("Top produits", 14, y1);

      autoTable(doc, {
        startY: y1 + 4,
        head: [["Produit", "Quantité vendue", "CA généré"]],
        body: (data?.top_products ?? []).map((p) => [
          p.name,
          String(p.quantity),
          formatCurrency(p.revenue),
        ]),
        styles: { fontSize: 10 },
        headStyles: { fillColor: [249, 115, 22] },
        alternateRowStyles: { fillColor: [248, 248, 248] },
      });
    }

    const y2 = (doc as any).lastAutoTable?.finalY ?? y1;

    // Répartition par statut
    if (statusData.length > 0) {
      const yNext = y2 + 10;
      doc.setFontSize(13);
      doc.setTextColor(30);
      doc.text("Commandes par statut", 14, yNext);

      autoTable(doc, {
        startY: yNext + 4,
        head: [["Statut", "Nombre"]],
        body: statusData.map((s) => [s.name, String(s.value)]),
        styles: { fontSize: 10 },
        headStyles: { fillColor: [249, 115, 22] },
      });
    }

    // CA par agence (si disponible)
    if (branchData && branchData.length > 0) {
      const y3 = (doc as any).lastAutoTable?.finalY ?? 200;
      const yBranch = y3 + 10;
      doc.setFontSize(13);
      doc.setTextColor(30);
      doc.text("Performances par agence", 14, yBranch);

      autoTable(doc, {
        startY: yBranch + 4,
        head: [["Agence", "Commandes", "Livrées", "CA"]],
        body: branchData.map((b) => [
          b.branch_name,
          String(b.orders),
          String(b.delivered),
          formatCurrency(b.revenue),
        ]),
        styles: { fontSize: 10 },
        headStyles: { fillColor: [249, 115, 22] },
      });
    }

    doc.save(`rapport-analytique-${period}j-${new Date().toISOString().slice(0, 10)}.pdf`);
  };

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{t("title")}</h1>
          <p className="text-sm text-slate-400">{t("subtitle")}</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">7 derniers jours</SelectItem>
              <SelectItem value="30">30 derniers jours</SelectItem>
              <SelectItem value="90">90 derniers jours</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={exportPDF} disabled={isLoading}>
            <Download className="h-4 w-4 mr-1.5" /> Rapport PDF
          </Button>
        </div>
      </div>

      {/* Stat cards — aujourd'hui */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: "CA aujourd'hui", value: formatCurrency(data?.today?.revenue ?? 0), icon: DollarSign, color: "text-brand-400", bg: "bg-brand-500/10" },
          { label: "Commandes du jour", value: data?.today?.orders ?? 0, icon: ShoppingBag, color: "text-blue-400", bg: "bg-blue-500/10" },
          { label: "Panier moyen", value: formatCurrency(data?.today?.avg_order ?? 0), icon: TrendingUp, color: "text-green-400", bg: "bg-green-500/10" },
          { label: "Ruptures stock", value: data?.today?.out_of_stock ?? 0, icon: Package, color: "text-red-400", bg: "bg-red-500/10" },
        ].map((s) => {
          const Icon = s.icon;
          return (
            <Card key={s.label}>
              <CardContent className="p-5">
                {isLoading ? <Skeleton className="h-16 w-full" /> : (
                  <div className="flex items-center gap-3">
                    <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${s.bg}`}>
                      <Icon className={`h-5 w-5 ${s.color}`} />
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">{s.label}</p>
                      <p className="text-xl font-bold text-slate-900">{s.value}</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Stat cards — période */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {[
          { label: `CA ${period}j`, value: formatCurrency(data?.period?.revenue ?? 0), icon: DollarSign, color: "text-brand-400" },
          { label: "Commandes", value: data?.period?.orders ?? 0, icon: ShoppingBag, color: "text-blue-400" },
          { label: "Livrées", value: data?.period?.delivered ?? 0, icon: CheckCircle2, color: "text-green-400" },
          { label: "Panier moyen", value: formatCurrency(data?.period?.avg_order ?? 0), icon: TrendingUp, color: "text-purple-400" },
          { label: "Taux conversion", value: `${data?.period?.conversion_rate ?? 0}%`, icon: PercentCircle, color: "text-amber-400" },
        ].map((s) => {
          const Icon = s.icon;
          return (
            <Card key={s.label} className="border-slate-200">
              <CardContent className="p-4">
                {isLoading ? <Skeleton className="h-12 w-full" /> : (
                  <div>
                    <p className={`text-xs font-medium ${s.color}`}>{s.label}</p>
                    <p className="text-lg font-bold text-slate-900 mt-0.5">{s.value}</p>
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

      {/* ── Vue générale ── */}
      {tab === "overview" && (
        <div className="space-y-4">
          {/* Ligne 1 : CA + commandes */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t("revenueEvolution")}</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? <Skeleton className="h-64 w-full" /> : (
                <ResponsiveContainer width="100%" height={260}>
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="date" tick={{ fill: "#64748b", fontSize: 11 }} tickLine={false} />
                    <YAxis tick={{ fill: "#64748b", fontSize: 11 }} tickLine={false} axisLine={false}
                      tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v} />
                    <Tooltip
                      contentStyle={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 8 }}
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

          {/* Ligne 2 : statuts + type + paiement */}
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
            {/* Par type */}
            <Card>
              <CardHeader><CardTitle className="text-base">Répartition par type</CardTitle></CardHeader>
              <CardContent>
                {isLoading ? <Skeleton className="h-48 w-full" /> : (
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie data={data?.orders_by_type ?? []} dataKey="count" nameKey="type"
                        cx="50%" cy="50%" outerRadius={70}
                        label={({ type, percent }) =>
                          `${type === "collect" ? "Collect" : "Livraison"} ${(percent * 100).toFixed(0)}%`
                        }
                        labelLine={false}>
                        {(data?.orders_by_type ?? []).map((_, i) => (
                          <Cell key={i} fill={COLORS[i % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 8 }} />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            {/* Par statut */}
            <Card>
              <CardHeader><CardTitle className="text-base">Commandes par statut</CardTitle></CardHeader>
              <CardContent>
                {isLoading ? <Skeleton className="h-48 w-full" /> : statusData.length === 0 ? (
                  <div className="flex items-center justify-center h-48 text-slate-500 gap-2">
                    <AlertCircle className="h-4 w-4" /> Aucune donnée
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={statusData} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
                      <XAxis type="number" tick={{ fill: "#64748b", fontSize: 10 }} tickLine={false} />
                      <YAxis type="category" dataKey="name" tick={{ fill: "#94a3b8", fontSize: 10 }}
                        tickLine={false} axisLine={false} width={90} />
                      <Tooltip contentStyle={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 8 }} />
                      <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                        {statusData.map((_, i) => (
                          <Cell key={i} fill={COLORS[i % COLORS.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            {/* Par moyen de paiement */}
            <Card>
              <CardHeader><CardTitle className="text-base">Modes de paiement</CardTitle></CardHeader>
              <CardContent>
                {isLoading ? <Skeleton className="h-48 w-full" /> : paymentData.length === 0 ? (
                  <div className="flex items-center justify-center h-48 text-slate-500 gap-2">
                    <AlertCircle className="h-4 w-4" /> Aucune donnée
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie data={paymentData} dataKey="value" nameKey="name"
                        cx="50%" cy="50%" outerRadius={70}
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                        labelLine={false}>
                        {paymentData.map((_, i) => (
                          <Cell key={i} fill={COLORS[(i + 2) % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 8 }} />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* ── Top produits ── */}
      {tab === "products" && (
        <Card>
          <CardHeader><CardTitle className="text-base">{t("topProducts")}</CardTitle></CardHeader>
          <CardContent>
            {isLoading ? <Skeleton className="h-80 w-full" /> : (data?.top_products ?? []).length === 0 ? (
              <div className="flex items-center justify-center h-64 text-slate-500 gap-2">
                <AlertCircle className="h-4 w-4" /> Aucune donnée sur cette période
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={400}>
                <BarChart data={(data?.top_products ?? []).slice(0, 10)} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
                  <XAxis type="number" tick={{ fill: "#64748b", fontSize: 11 }} tickLine={false}
                    tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v} />
                  <YAxis type="category" dataKey="name" tick={{ fill: "#94a3b8", fontSize: 12 }}
                    tickLine={false} axisLine={false} width={160} />
                  <Tooltip
                    contentStyle={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 8 }}
                    formatter={(v: number, name: string) =>
                      name === "revenue" ? [formatCurrency(v), "CA"] : [v, "Quantité"]
                    }
                  />
                  <Legend formatter={(v) => v === "revenue" ? "CA (FCFA)" : "Quantité vendue"} />
                  <Bar dataKey="revenue" fill="#f97316" radius={[0, 4, 4, 0]} />
                  <Bar dataKey="quantity" fill="#3b82f6" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── Par agence ── */}
      {tab === "branches" && (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <Card>
            <CardHeader><CardTitle className="text-base">{t("byBranch")} — CA</CardTitle></CardHeader>
            <CardContent>
              {branchLoading ? <Skeleton className="h-64 w-full" /> : !branchData || branchData.length === 0 ? (
                <div className="flex items-center justify-center h-64 text-slate-500 gap-2">
                  <AlertCircle className="h-4 w-4" /> Aucune agence
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={branchData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="branch_name" tick={{ fill: "#64748b", fontSize: 11 }} tickLine={false} />
                    <YAxis tick={{ fill: "#64748b", fontSize: 11 }} tickLine={false} axisLine={false}
                      tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v} />
                    <Tooltip
                      contentStyle={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 8 }}
                      formatter={(v: number) => [formatCurrency(v), "CA"]}
                    />
                    <Bar dataKey="revenue" fill="#f97316" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">{t("byBranch")} — Commandes</CardTitle></CardHeader>
            <CardContent>
              {branchLoading ? <Skeleton className="h-64 w-full" /> : !branchData || branchData.length === 0 ? (
                <div className="flex items-center justify-center h-64 text-slate-500 gap-2">
                  <AlertCircle className="h-4 w-4" /> Aucune agence
                </div>
              ) : (
                <div className="space-y-3">
                  {branchData.map((b) => {
                    const max = Math.max(...branchData.map((x) => x.orders), 1);
                    return (
                      <div key={b.branch_id}>
                        <div className="flex items-center justify-between text-sm mb-1">
                          <span className="text-slate-900 font-medium">{b.branch_name}</span>
                          <span className="text-slate-400">
                            {b.orders} commandes · <span className="text-green-400">{b.delivered} livrées</span>
                          </span>
                        </div>
                        <div className="h-2 rounded-full bg-slate-50">
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
