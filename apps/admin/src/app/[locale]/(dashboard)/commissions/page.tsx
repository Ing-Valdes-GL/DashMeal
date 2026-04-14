"use client";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { apiGet, apiPost, apiPatch } from "@/lib/api";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Pagination } from "@/components/ui/pagination";
import { DollarSign, TrendingUp, CheckCircle, Clock, RefreshCw } from "lucide-react";

interface Commission {
  id: string; type: "online" | "inperson"; rate: number; amount: number;
  settled_at: string | null; created_at: string;
  orders?: { id: string; total: number };
  brands?: { name: string };
}

interface Summary {
  total: number; online: number; inperson: number;
  settled: number; pending: number; count: number;
}

export default function CommissionsPage() {
  const t = useTranslations("commissions");
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState("all");
  const [selected, setSelected] = useState<string[]>([]);

  const { data: summary, isLoading: sumLoading } = useQuery<Summary>({
    queryKey: ["commissions-summary"],
    queryFn: () => apiGet("/commissions/summary"),
  });

  const { data, isLoading, refetch } = useQuery<{ data: Commission[]; pagination: any }>({
    queryKey: ["commissions", { page, statusFilter }],
    queryFn: () => apiGet("/commissions", {
      page, limit: 20,
      ...(statusFilter !== "all" && { settled: statusFilter === "settled" ? "true" : "false" }),
    }) as any,
  });

  const settleMutation = useMutation({
    mutationFn: (id: string) => apiPatch(`/commissions/${id}/settle`, {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["commissions"] });
      qc.invalidateQueries({ queryKey: ["commissions-summary"] });
      toast.success("Commission marquée comme reversée");
    },
    onError: () => toast.error("Erreur"),
  });

  const settleBatchMutation = useMutation({
    mutationFn: (ids: string[]) => apiPost("/commissions/settle-batch", { ids }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["commissions"] });
      qc.invalidateQueries({ queryKey: ["commissions-summary"] });
      toast.success(`${selected.length} commissions reversées`);
      setSelected([]);
    },
    onError: () => toast.error("Erreur"),
  });

  const commissions = data?.data ?? [];

  const summaryCards = [
    { label: t("total"), value: formatCurrency(summary?.total ?? 0), icon: DollarSign, color: "text-brand-400", bg: "bg-brand-500/10" },
    { label: t("online"), value: formatCurrency(summary?.online ?? 0), icon: TrendingUp, color: "text-blue-400", bg: "bg-blue-500/10" },
    { label: t("inperson"), value: formatCurrency(summary?.inperson ?? 0), icon: TrendingUp, color: "text-purple-400", bg: "bg-purple-500/10" },
    { label: t("pending"), value: formatCurrency(summary?.pending ?? 0), icon: Clock, color: "text-amber-400", bg: "bg-amber-500/10" },
    { label: t("settled"), value: formatCurrency(summary?.settled ?? 0), icon: CheckCircle, color: "text-green-400", bg: "bg-green-500/10" },
  ];

  const toggleSelect = (id: string) => {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const toggleAll = () => {
    const unsettled = commissions.filter((c) => !c.settled_at).map((c) => c.id);
    if (selected.length === unsettled.length) {
      setSelected([]);
    } else {
      setSelected(unsettled);
    }
  };

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">{t("title")}</h1>
          <p className="text-sm text-slate-400">{t("subtitle")}</p>
        </div>
        <Button variant="ghost" size="sm" onClick={() => refetch()}>
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {summaryCards.map((s) => {
          const Icon = s.icon;
          return (
            <Card key={s.label}>
              <CardContent className="p-4">
                {sumLoading ? (
                  <Skeleton className="h-14 w-full" />
                ) : (
                  <div className="flex items-center gap-2.5">
                    <div className={`h-9 w-9 rounded-lg flex items-center justify-center shrink-0 ${s.bg}`}>
                      <Icon className={`h-4 w-4 ${s.color}`} />
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">{s.label}</p>
                      <p className="text-base font-bold text-white">{s.value}</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Filters + batch action */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1); setSelected([]); }}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toutes</SelectItem>
            <SelectItem value="pending">{t("pending")}</SelectItem>
            <SelectItem value="settled">{t("settled")}</SelectItem>
          </SelectContent>
        </Select>

        {selected.length > 0 && (
          <Button
            onClick={() => settleBatchMutation.mutate(selected)}
            disabled={settleBatchMutation.isPending}
          >
            <CheckCircle className="h-4 w-4 mr-2" />
            {t("settleSelected")} ({selected.length})
          </Button>
        )}
      </div>

      {/* Table */}
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-surface-500 bg-surface-700 accent-brand-500"
                  checked={selected.length > 0 && selected.length === commissions.filter(c => !c.settled_at).length}
                  onChange={toggleAll}
                />
              </TableHead>
              <TableHead>{t("brand")}</TableHead>
              <TableHead>{t("payment")}</TableHead>
              <TableHead>{t("type")}</TableHead>
              <TableHead>{t("rate")}</TableHead>
              <TableHead>{t("amount")}</TableHead>
              <TableHead>{t("settledAt")}</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading
              ? Array.from({ length: 8 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 8 }).map((_, j) => (
                      <TableCell key={j}><Skeleton className="h-5 w-full" /></TableCell>
                    ))}
                  </TableRow>
                ))
              : commissions.map((c) => (
                  <TableRow key={c.id} className={selected.includes(c.id) ? "bg-surface-700/50" : ""}>
                    <TableCell>
                      {!c.settled_at && (
                        <input
                          type="checkbox"
                          className="h-4 w-4 rounded border-surface-500 bg-surface-700 accent-brand-500"
                          checked={selected.includes(c.id)}
                          onChange={() => toggleSelect(c.id)}
                        />
                      )}
                    </TableCell>
                    <TableCell className="font-medium text-white">
                      {c.brands?.name ?? "—"}
                    </TableCell>
                    <TableCell>
                      <span className="font-mono text-xs text-slate-500">
                        #{c.orders?.id?.slice(0, 8) ?? "—"}
                      </span>
                      <p className="text-sm text-white">{formatCurrency(c.orders?.total ?? 0)}</p>
                    </TableCell>
                    <TableCell>
                      <Badge variant={c.type === "online" ? "info" : "pending"}>
                        {c.type === "online" ? "En ligne" : "Présentiel"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-slate-300">{(c.rate * 100).toFixed(1)}%</TableCell>
                    <TableCell className="font-bold text-brand-400">{formatCurrency(c.amount)}</TableCell>
                    <TableCell>
                      {c.settled_at ? (
                        <span className="text-xs text-green-400">{formatDateTime(c.settled_at)}</span>
                      ) : (
                        <Badge variant="pending">En attente</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {!c.settled_at && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            if (confirm(t("confirmSettle"))) settleMutation.mutate(c.id);
                          }}
                          disabled={settleMutation.isPending}
                        >
                          <CheckCircle className="h-3.5 w-3.5 mr-1" />
                          Reverser
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
          </TableBody>
        </Table>
        {data?.pagination && (
          <div className="p-4 border-t border-surface-700/50">
            <Pagination page={data.pagination.page} totalPages={data.pagination.total_pages}
              total={data.pagination.total} limit={data.pagination.limit} onPageChange={setPage} />
          </div>
        )}
      </Card>
    </div>
  );
}
