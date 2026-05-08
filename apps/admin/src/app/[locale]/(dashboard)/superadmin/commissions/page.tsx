"use client";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuthStore } from "@/stores/auth";
import { apiGet } from "@/lib/api";
import { formatCurrency } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from "recharts";
import {
  DollarSign, Clock, CheckCircle2, TrendingUp,
  ShieldAlert, RefreshCw, BarChart3,
} from "lucide-react";

interface CommissionEntry {
  brand_id: string;
  brand_name: string;
  online_commissions: number;
  inperson_commissions: number;
  total: number;
  settled: boolean;
}

interface CommissionsByDay {
  date: string;
  amount: number;
}

interface CommissionsData {
  total_online: number;
  total_inperson: number;
  pending_settlement: number;
  total_settled: number;
  commissions_by_day: CommissionsByDay[];
  entries: CommissionEntry[];
}

interface PlatformStats {
  total_brands: number;
  total_orders: number;
  total_revenue: number;
  total_commissions: number;
  active_brands: number;
}

export default function SuperadminCommissionsPage() {
  const { user } = useAuthStore();
  const [period, setPeriod] = useState("30");

  const { data, isLoading, refetch } = useQuery<CommissionsData>({
    queryKey: ["sa-commissions", period],
    queryFn: () => apiGet("/analytics/commissions", { days: period }),
    enabled: user?.role === "superadmin",
    staleTime: 60_000,
  });

  const { data: platform, isLoading: platformLoading } = useQuery<PlatformStats>({
    queryKey: ["sa-platform"],
    queryFn: () => apiGet("/analytics/platform"),
    enabled: user?.role === "superadmin",
    staleTime: 60_000,
  });

  // Guard — non-superadmin users
  if (user?.role !== "superadmin") {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <div className="h-16 w-16 rounded-2xl bg-red-500/10 flex items-center justify-center">
          <ShieldAlert className="h-8 w-8 text-red-400" />
        </div>
        <h2 className="text-xl font-bold text-slate-900">Accès restreint</h2>
        <p className="text-sm text-slate-400 text-center max-w-sm">
          Cette page est réservée aux administrateurs de la plateforme (superadmin).
        </p>
      </div>
    );
  }

  const chartData = (data?.commissions_by_day ?? []).map((d) => ({
    date: new Date(d.date).toLocaleDateString("fr-FR", { day: "numeric", month: "short" }),
    Commissions: d.amount,
  }));

  const totalCommissions = (data?.total_online ?? 0) + (data?.total_inperson ?? 0);

  const kpiCards = [
    {
      label: "Commissions totales",
      value: formatCurrency(totalCommissions),
      icon: DollarSign,
      color: "text-brand-400",
      bg: "bg-brand-500/10",
    },
    {
      label: "En ligne",
      value: formatCurrency(data?.total_online ?? 0),
      icon: TrendingUp,
      color: "text-blue-400",
      bg: "bg-blue-500/10",
    },
    {
      label: "Présentiel",
      value: formatCurrency(data?.total_inperson ?? 0),
      icon: TrendingUp,
      color: "text-purple-400",
      bg: "bg-purple-500/10",
    },
    {
      label: "En attente de reversement",
      value: formatCurrency(data?.pending_settlement ?? 0),
      icon: Clock,
      color: "text-amber-400",
      bg: "bg-amber-500/10",
    },
    {
      label: "Reversées",
      value: formatCurrency(data?.total_settled ?? 0),
      icon: CheckCircle2,
      color: "text-green-400",
      bg: "bg-green-500/10",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <BarChart3 className="h-6 w-6 text-brand-400" />
            Commissions Plateforme
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Vue globale des commissions générées par toutes les marques.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">7 derniers jours</SelectItem>
              <SelectItem value="30">30 derniers jours</SelectItem>
              <SelectItem value="90">90 derniers jours</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="ghost" size="sm" onClick={() => refetch()} className="text-slate-400">
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Platform stats */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          { label: "Marques actives", value: platform?.active_brands ?? 0, color: "text-brand-500" },
          { label: "Total marques", value: platform?.total_brands ?? 0, color: "text-slate-900" },
          { label: "Commandes totales", value: platform?.total_orders ?? 0, color: "text-blue-500" },
          { label: "CA Plateforme", value: formatCurrency(platform?.total_revenue ?? 0), color: "text-green-500" },
        ].map((s) => (
          <Card key={s.label}>
            <CardContent className="p-4">
              {platformLoading ? (
                <Skeleton className="h-12 w-full" />
              ) : (
                <>
                  <p className="text-xs text-slate-400">{s.label}</p>
                  <p className={`text-xl font-bold mt-1 ${s.color}`}>{s.value}</p>
                </>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        {kpiCards.map((card) => {
          const Icon = card.icon;
          return (
            <Card key={card.label}>
              <CardContent className="p-4">
                {isLoading ? (
                  <Skeleton className="h-14 w-full" />
                ) : (
                  <div className="flex items-center gap-2.5">
                    <div className={`h-9 w-9 rounded-lg flex items-center justify-center shrink-0 ${card.bg}`}>
                      <Icon className={`h-4 w-4 ${card.color}`} />
                    </div>
                    <div>
                      <p className="text-xs text-slate-400 leading-tight">{card.label}</p>
                      <p className="text-sm font-bold text-slate-900 mt-0.5">{card.value}</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Line chart */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Évolution des commissions — {period} derniers jours</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-64 w-full" />
          ) : chartData.length === 0 ? (
            <div className="flex items-center justify-center h-64 text-slate-400 gap-2">
              <BarChart3 className="h-5 w-5 opacity-40" />
              Aucune donnée sur cette période
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis
                  dataKey="date"
                  tick={{ fill: "#64748b", fontSize: 11 }}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: "#64748b", fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)}
                />
                <Tooltip
                  contentStyle={{
                    background: "#ffffff",
                    border: "1px solid #e2e8f0",
                    borderRadius: 8,
                  }}
                  formatter={(v: number) => [formatCurrency(v), "Commissions"]}
                />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="Commissions"
                  stroke="#f97316"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4, fill: "#f97316" }}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Per-brand table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Commissions par marque</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Marque</TableHead>
                <TableHead>Commissions en ligne</TableHead>
                <TableHead>Commissions présentiel</TableHead>
                <TableHead>Total</TableHead>
                <TableHead>Statut</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading
                ? Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      {Array.from({ length: 5 }).map((_, j) => (
                        <TableCell key={j}><Skeleton className="h-5 w-full" /></TableCell>
                      ))}
                    </TableRow>
                  ))
                : !data?.entries || data.entries.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5}>
                        <div className="flex flex-col items-center justify-center py-10 gap-2 text-slate-400">
                          <BarChart3 className="h-8 w-8 opacity-30" />
                          <p className="text-sm">Aucune commission sur cette période</p>
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                : data.entries.map((entry) => (
                    <TableRow key={entry.brand_id}>
                      <TableCell className="font-semibold text-slate-900">{entry.brand_name}</TableCell>
                      <TableCell className="text-blue-500 font-medium">
                        {formatCurrency(entry.online_commissions)}
                      </TableCell>
                      <TableCell className="text-purple-500 font-medium">
                        {formatCurrency(entry.inperson_commissions)}
                      </TableCell>
                      <TableCell className="font-bold text-brand-500">
                        {formatCurrency(entry.total)}
                      </TableCell>
                      <TableCell>
                        {entry.settled ? (
                          <Badge
                            variant="outline"
                            className="border-green-500/30 bg-green-500/10 text-green-400 text-xs gap-1"
                          >
                            <CheckCircle2 className="h-3 w-3" /> Reversée
                          </Badge>
                        ) : (
                          <Badge
                            variant="outline"
                            className="border-amber-500/30 bg-amber-500/10 text-amber-400 text-xs gap-1"
                          >
                            <Clock className="h-3 w-3" /> En attente
                          </Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
