"use client";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiGet, api } from "@/lib/api";
import { formatCurrency } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  FileDown, ShoppingBag, DollarSign, TrendingUp,
  Truck, Award, Package, RefreshCw, AlertCircle,
} from "lucide-react";

interface ReportSummary {
  total_orders: number;
  total_revenue: number;
  avg_order: number;
  delivered: number;
  cancelled: number;
  top_branch: string | null;
  top_product: string | null;
}

function getDefaultDates() {
  const today = new Date();
  const from = new Date(today.getFullYear(), today.getMonth(), 1);
  return {
    from: from.toISOString().slice(0, 10),
    to: today.toISOString().slice(0, 10),
  };
}

export default function ReportsPage() {
  const defaults = getDefaultDates();
  const [fromDate, setFromDate] = useState(defaults.from);
  const [toDate, setToDate] = useState(defaults.to);
  const [downloading, setDownloading] = useState<"orders" | "products" | null>(null);

  const validRange = fromDate && toDate && fromDate <= toDate;

  const { data: summary, isLoading, refetch } = useQuery<ReportSummary>({
    queryKey: ["reports-summary", fromDate, toDate],
    queryFn: () => apiGet("/reports/summary", { from: fromDate, to: toDate }),
    enabled: !!validRange,
    staleTime: 60_000,
  });

  async function downloadCsv(type: "orders" | "products") {
    setDownloading(type);
    try {
      const endpoint = type === "orders" ? "/reports/orders.csv" : "/reports/products.csv";
      const response = await api.get(endpoint, {
        params: { from: fromDate, to: toDate },
        responseType: "blob",
      });

      const url = URL.createObjectURL(new Blob([response.data], { type: "text/csv" }));
      const link = document.createElement("a");
      link.href = url;
      link.download = `${type}-${fromDate}-${toDate}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast.success(
        "Export réussi",
        `Fichier ${type === "orders" ? "commandes" : "produits"} téléchargé.`
      );
    } catch {
      toast.error("Erreur d'export", "Impossible de télécharger le fichier CSV.");
    } finally {
      setDownloading(null);
    }
  }

  const kpiCards = [
    {
      label: "Commandes totales",
      value: summary?.total_orders ?? 0,
      format: (v: number) => String(v),
      icon: ShoppingBag,
      color: "text-blue-400",
      bg: "bg-blue-500/10",
    },
    {
      label: "Chiffre d'affaires",
      value: summary?.total_revenue ?? 0,
      format: (v: number) => formatCurrency(v),
      icon: DollarSign,
      color: "text-brand-400",
      bg: "bg-brand-500/10",
    },
    {
      label: "Panier moyen",
      value: summary?.avg_order ?? 0,
      format: (v: number) => formatCurrency(v),
      icon: TrendingUp,
      color: "text-purple-400",
      bg: "bg-purple-500/10",
    },
    {
      label: "Livraisons réussies",
      value: summary?.delivered ?? 0,
      format: (v: number) => String(v),
      icon: Truck,
      color: "text-green-400",
      bg: "bg-green-500/10",
    },
    {
      label: "Annulées",
      value: summary?.cancelled ?? 0,
      format: (v: number) => String(v),
      icon: AlertCircle,
      color: "text-red-400",
      bg: "bg-red-500/10",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <FileDown className="h-6 w-6 text-brand-400" />
            Rapports & Exports
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Exportez vos données de commandes et produits en CSV.
          </p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => refetch()}
          disabled={!validRange}
          className="text-slate-400 gap-1.5"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Actualiser
        </Button>
      </div>

      {/* Date range picker */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Période d&apos;analyse</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4 items-end">
            <div className="space-y-1.5">
              <Label>Du</Label>
              <Input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="w-44"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Au</Label>
              <Input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="w-44"
              />
            </div>
            {/* Quick ranges */}
            <div className="flex gap-2 flex-wrap">
              {[
                { label: "Ce mois", days: null, onClick: () => { const d = getDefaultDates(); setFromDate(d.from); setToDate(d.to); } },
                {
                  label: "7 derniers jours", days: 7, onClick: () => {
                    const to = new Date();
                    const from = new Date(); from.setDate(to.getDate() - 7);
                    setFromDate(from.toISOString().slice(0, 10));
                    setToDate(to.toISOString().slice(0, 10));
                  }
                },
                {
                  label: "30 derniers jours", days: 30, onClick: () => {
                    const to = new Date();
                    const from = new Date(); from.setDate(to.getDate() - 30);
                    setFromDate(from.toISOString().slice(0, 10));
                    setToDate(to.toISOString().slice(0, 10));
                  }
                },
                {
                  label: "90 derniers jours", days: 90, onClick: () => {
                    const to = new Date();
                    const from = new Date(); from.setDate(to.getDate() - 90);
                    setFromDate(from.toISOString().slice(0, 10));
                    setToDate(to.toISOString().slice(0, 10));
                  }
                },
              ].map((q) => (
                <Button key={q.label} variant="outline" size="sm" onClick={q.onClick} className="text-xs">
                  {q.label}
                </Button>
              ))}
            </div>
          </div>
          {fromDate && toDate && fromDate > toDate && (
            <p className="text-xs text-red-400 mt-2 flex items-center gap-1">
              <AlertCircle className="h-3 w-3" />
              La date de début doit être antérieure à la date de fin.
            </p>
          )}
        </CardContent>
      </Card>

      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
        {kpiCards.map((card) => {
          const Icon = card.icon;
          return (
            <Card key={card.label}>
              <CardContent className="p-4">
                {isLoading ? (
                  <Skeleton className="h-16 w-full" />
                ) : (
                  <div className="flex items-center gap-3">
                    <div className={`h-9 w-9 rounded-lg flex items-center justify-center shrink-0 ${card.bg}`}>
                      <Icon className={`h-4 w-4 ${card.color}`} />
                    </div>
                    <div>
                      <p className="text-xs text-slate-400">{card.label}</p>
                      <p className="text-base font-bold text-slate-900">{card.format(card.value)}</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Top performers */}
      {!isLoading && summary && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-yellow-500/10 flex items-center justify-center shrink-0">
                <Award className="h-5 w-5 text-yellow-500" />
              </div>
              <div>
                <p className="text-xs text-slate-400">Meilleure agence</p>
                <p className="font-semibold text-slate-900">{summary.top_branch ?? "—"}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-green-500/10 flex items-center justify-center shrink-0">
                <Package className="h-5 w-5 text-green-500" />
              </div>
              <div>
                <p className="text-xs text-slate-400">Produit le plus vendu</p>
                <p className="font-semibold text-slate-900">{summary.top_product ?? "—"}</p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Export section */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Exporter les données</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-slate-400 mb-4">
            Les fichiers CSV exportés couvrent la période sélectionnée ci-dessus.
          </p>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {/* Orders CSV */}
            <div className="rounded-xl border border-slate-200 p-4 space-y-3">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
                  <ShoppingBag className="h-5 w-5 text-blue-400" />
                </div>
                <div>
                  <p className="font-semibold text-slate-900">Export Commandes</p>
                  <p className="text-xs text-slate-400">ID, client, statut, total, date, agence</p>
                </div>
              </div>
              <Button
                className="w-full gap-2"
                variant="outline"
                disabled={!validRange || downloading === "orders"}
                onClick={() => downloadCsv("orders")}
              >
                <FileDown className="h-4 w-4" />
                {downloading === "orders" ? "Téléchargement…" : "Exporter commandes CSV"}
              </Button>
            </div>

            {/* Products CSV */}
            <div className="rounded-xl border border-slate-200 p-4 space-y-3">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-green-500/10 flex items-center justify-center">
                  <Package className="h-5 w-5 text-green-400" />
                </div>
                <div>
                  <p className="font-semibold text-slate-900">Export Produits</p>
                  <p className="text-xs text-slate-400">Nom, quantité vendue, CA, agence</p>
                </div>
              </div>
              <Button
                className="w-full gap-2"
                variant="outline"
                disabled={!validRange || downloading === "products"}
                onClick={() => downloadCsv("products")}
              >
                <FileDown className="h-4 w-4" />
                {downloading === "products" ? "Téléchargement…" : "Exporter produits CSV"}
              </Button>
            </div>
          </div>

          {!validRange && (
            <p className="text-xs text-amber-500 flex items-center gap-1 mt-3">
              <AlertCircle className="h-3.5 w-3.5" />
              Sélectionnez une plage de dates valide pour activer les exports.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
