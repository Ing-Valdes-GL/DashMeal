"use client";
import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPatch } from "@/lib/api";
import { formatCurrency, cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { RefreshCw, Store, Clock, ShoppingBag, User, MapPin, AlertCircle } from "lucide-react";

interface Order {
  id: string;
  total: number;
  status: string;
  type: string;
  created_at: string;
  notes: string | null;
  branch_name?: string;
  users?: { name: string; phone: string };
  branches?: { name: string };
}

const STATUS_COLUMNS = [
  { key: "pending", label: "En attente", color: "border-yellow-400 bg-yellow-400/5" },
  { key: "confirmed", label: "Confirmées", color: "border-blue-400 bg-blue-400/5" },
  { key: "preparing", label: "En préparation", color: "border-orange-400 bg-orange-400/5" },
  { key: "ready", label: "Prêtes", color: "border-purple-400 bg-purple-400/5" },
  { key: "delivering", label: "En livraison", color: "border-cyan-400 bg-cyan-400/5" },
  { key: "delivered", label: "Livrées", color: "border-green-400 bg-green-400/5" },
  { key: "cancelled", label: "Annulées", color: "border-red-400 bg-red-400/5" },
];

const STATUS_BADGE: Record<string, string> = {
  pending:    "border-yellow-500/30 bg-yellow-500/10 text-yellow-400",
  confirmed:  "border-blue-500/30 bg-blue-500/10 text-blue-400",
  preparing:  "border-orange-500/30 bg-orange-500/10 text-orange-400",
  ready:      "border-purple-500/30 bg-purple-500/10 text-purple-400",
  delivering: "border-cyan-500/30 bg-cyan-500/10 text-cyan-400",
  delivered:  "border-green-500/30 bg-green-500/10 text-green-400",
  cancelled:  "border-red-500/30 bg-red-500/10 text-red-400",
};

const STATUS_LABEL: Record<string, string> = {
  pending: "En attente", confirmed: "Confirmée", preparing: "En préparation",
  ready: "Prête", delivering: "En livraison", delivered: "Livrée", cancelled: "Annulée",
};

const NEXT_STATUSES: Record<string, string[]> = {
  pending:    ["confirmed", "cancelled"],
  confirmed:  ["preparing", "cancelled"],
  preparing:  ["ready", "cancelled"],
  ready:      ["delivering", "delivered"],
  delivering: ["delivered"],
};

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "À l'instant";
  if (mins < 60) return `il y a ${mins}min`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `il y a ${hrs}h`;
  return `il y a ${Math.floor(hrs / 24)}j`;
}

export default function GlobalKanbanPage() {
  const qc = useQueryClient();
  const [branchFilter, setBranchFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [advanceStatus, setAdvanceStatus] = useState("");
  const [advanceNote, setAdvanceNote] = useState("");
  const refreshRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const { data: orders = [], isLoading, refetch } = useQuery<Order[]>({
    queryKey: ["orders-global"],
    queryFn: () => apiGet("/orders", { all: "true", limit: 300 }) as any,
    staleTime: 0,
  });

  // Auto-refresh every 30s
  useEffect(() => {
    refreshRef.current = setInterval(() => refetch(), 30_000);
    return () => { if (refreshRef.current) clearInterval(refreshRef.current); };
  }, [refetch]);

  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status, note }: { id: string; status: string; note?: string }) =>
      apiPatch(`/orders/${id}/status`, { status, note }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["orders-global"] });
      toast.success("Statut mis à jour");
      setSelectedOrder(null);
    },
    onError: () => toast.error("Impossible de mettre à jour le statut"),
  });

  // Derive unique branches
  const branches = Array.from(
    new Set(
      orders.map((o) => o.branch_name ?? o.branches?.name).filter(Boolean) as string[]
    )
  );

  const filteredOrders = orders.filter((o) => {
    const branchName = o.branch_name ?? o.branches?.name;
    if (branchFilter !== "all" && branchName !== branchFilter) return false;
    if (statusFilter !== "all" && o.status !== statusFilter) return false;
    return true;
  });

  const columnOrders = (status: string) =>
    filteredOrders.filter((o) => o.status === status);

  const activeColumns = statusFilter === "all"
    ? STATUS_COLUMNS
    : STATUS_COLUMNS.filter((c) => c.key === statusFilter);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <ShoppingBag className="h-6 w-6 text-brand-400" />
            Kanban Global
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Vue consolidée de toutes les agences — rafraîchissement auto toutes les 30s.
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={() => refetch()} className="text-slate-400 gap-1.5">
          <RefreshCw className="h-3.5 w-3.5" />
          Actualiser
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <Select value={branchFilter} onValueChange={setBranchFilter}>
          <SelectTrigger className="w-52">
            <Store className="h-3.5 w-3.5 mr-2 text-slate-400" />
            <SelectValue placeholder="Toutes les agences" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toutes les agences</SelectItem>
            {branches.map((b) => (
              <SelectItem key={b} value={b}>{b}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Tous les statuts" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les statuts</SelectItem>
            {STATUS_COLUMNS.map((s) => (
              <SelectItem key={s.key} value={s.key}>{s.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex items-center gap-2 text-sm text-slate-400 ml-auto">
          <span className="h-2 w-2 rounded-full bg-green-400 animate-pulse" />
          {filteredOrders.length} commande{filteredOrders.length !== 1 ? "s" : ""}
        </div>
      </div>

      {/* Kanban board */}
      {isLoading ? (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4 xl:grid-cols-7">
          {STATUS_COLUMNS.map((col) => (
            <div key={col.key} className="space-y-2">
              <Skeleton className="h-8 w-full rounded-lg" />
              {Array.from({ length: 2 }).map((_, i) => (
                <Skeleton key={i} className="h-28 w-full rounded-xl" />
              ))}
            </div>
          ))}
        </div>
      ) : (
        <div className="flex gap-3 overflow-x-auto pb-4">
          {activeColumns.map((col) => {
            const colOrders = columnOrders(col.key);
            return (
              <div key={col.key} className="min-w-[220px] flex-shrink-0 flex flex-col gap-2">
                {/* Column header */}
                <div className={cn("rounded-lg border px-3 py-2 flex items-center justify-between", col.color)}>
                  <span className="text-sm font-semibold text-slate-700">{col.label}</span>
                  <Badge variant="outline" className="text-xs border-0 bg-white/60 text-slate-600">
                    {colOrders.length}
                  </Badge>
                </div>

                {/* Cards */}
                <div className="flex flex-col gap-2 min-h-[120px]">
                  {colOrders.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-slate-200 flex items-center justify-center h-20 text-slate-400 text-xs">
                      Vide
                    </div>
                  ) : (
                    colOrders.map((order) => (
                      <button
                        key={order.id}
                        onClick={() => {
                          setSelectedOrder(order);
                          setAdvanceStatus(NEXT_STATUSES[order.status]?.[0] ?? "");
                          setAdvanceNote("");
                        }}
                        className="w-full text-left rounded-xl border border-slate-200 bg-white p-3 shadow-sm hover:border-brand-400 hover:shadow-md transition-all"
                      >
                        <div className="flex items-start justify-between gap-1 mb-2">
                          <span className="font-mono text-xs text-slate-400">#{order.id.slice(0, 8)}</span>
                          <span className="text-xs text-slate-400 flex items-center gap-0.5">
                            <Clock className="h-3 w-3" />
                            {timeAgo(order.created_at)}
                          </span>
                        </div>
                        <p className="text-sm font-medium text-slate-900 leading-tight">
                          {order.users?.name ?? "Client"}
                        </p>
                        <p className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                          <Store className="h-3 w-3" />
                          {order.branch_name ?? order.branches?.name ?? "—"}
                        </p>
                        <p className="text-sm font-bold text-brand-500 mt-1.5">
                          {formatCurrency(order.total)}
                        </p>
                      </button>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Order detail + advance dialog */}
      <Dialog open={!!selectedOrder} onOpenChange={(o) => { if (!o) setSelectedOrder(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              Commande{" "}
              <span className="font-mono text-brand-500">#{selectedOrder?.id.slice(0, 8)}</span>
            </DialogTitle>
          </DialogHeader>
          {selectedOrder && (
            <div className="space-y-4">
              {/* Info grid */}
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-slate-400 text-xs mb-0.5">Client</p>
                  <p className="font-medium text-slate-900 flex items-center gap-1">
                    <User className="h-3.5 w-3.5 text-slate-400" />
                    {selectedOrder.users?.name ?? "—"}
                  </p>
                </div>
                <div>
                  <p className="text-slate-400 text-xs mb-0.5">Téléphone</p>
                  <p className="text-slate-900">{selectedOrder.users?.phone ?? "—"}</p>
                </div>
                <div>
                  <p className="text-slate-400 text-xs mb-0.5">Agence</p>
                  <p className="text-slate-900 flex items-center gap-1">
                    <MapPin className="h-3.5 w-3.5 text-slate-400" />
                    {selectedOrder.branch_name ?? selectedOrder.branches?.name ?? "—"}
                  </p>
                </div>
                <div>
                  <p className="text-slate-400 text-xs mb-0.5">Total</p>
                  <p className="font-bold text-brand-500">{formatCurrency(selectedOrder.total)}</p>
                </div>
                <div>
                  <p className="text-slate-400 text-xs mb-0.5">Statut actuel</p>
                  <Badge
                    variant="outline"
                    className={cn("text-xs", STATUS_BADGE[selectedOrder.status])}
                  >
                    {STATUS_LABEL[selectedOrder.status] ?? selectedOrder.status}
                  </Badge>
                </div>
                <div>
                  <p className="text-slate-400 text-xs mb-0.5">Type</p>
                  <Badge
                    variant="outline"
                    className={
                      selectedOrder.type === "collect"
                        ? "border-purple-500/30 bg-purple-500/10 text-purple-400 text-xs"
                        : "border-cyan-500/30 bg-cyan-500/10 text-cyan-400 text-xs"
                    }
                  >
                    {selectedOrder.type === "collect" ? "Retrait" : "Livraison"}
                  </Badge>
                </div>
              </div>

              {selectedOrder.notes && (
                <div className="rounded-lg bg-slate-50 border border-slate-200 p-3 text-sm text-slate-600">
                  <p className="text-xs text-slate-400 mb-1 uppercase font-medium tracking-wide">Note</p>
                  {selectedOrder.notes}
                </div>
              )}

              {/* Advance status */}
              {NEXT_STATUSES[selectedOrder.status] && NEXT_STATUSES[selectedOrder.status].length > 0 && (
                <div className="space-y-3 border-t border-slate-100 pt-3">
                  <p className="text-sm font-semibold text-slate-700">Avancer le statut</p>
                  <div className="space-y-1.5">
                    <Label>Nouveau statut</Label>
                    <Select value={advanceStatus} onValueChange={setAdvanceStatus}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {NEXT_STATUSES[selectedOrder.status].map((s) => (
                          <SelectItem key={s} value={s}>{STATUS_LABEL[s] ?? s}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Note (optionnel)</Label>
                    <Textarea
                      placeholder="Ex : Client prévenu, livreur en route…"
                      rows={2}
                      value={advanceNote}
                      onChange={(e) => setAdvanceNote(e.target.value)}
                    />
                  </div>
                </div>
              )}
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setSelectedOrder(null)}>Fermer</Button>
            {selectedOrder && NEXT_STATUSES[selectedOrder.status]?.length > 0 && (
              <Button
                disabled={!advanceStatus || updateStatusMutation.isPending}
                onClick={() =>
                  updateStatusMutation.mutate({
                    id: selectedOrder.id,
                    status: advanceStatus,
                    note: advanceNote || undefined,
                  })
                }
              >
                {updateStatusMutation.isPending ? "Mise à jour…" : "Confirmer le statut"}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
