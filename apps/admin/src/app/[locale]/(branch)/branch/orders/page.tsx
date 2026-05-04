"use client";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { branchApiGet, branchApiPatch, branchApiPost } from "@/lib/branch-api";
import { formatCurrency } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Search, Clock, ChevronRight, X, QrCode, ScanLine } from "lucide-react";

type OrderStatus = "pending" | "confirmed" | "preparing" | "ready" | "delivering" | "delivered" | "cancelled";

interface OrderItem { name_fr: string; quantity: number; unit_price: number }
interface Order {
  id: string;
  status: OrderStatus;
  total_amount: number;
  delivery_fee: number;
  payment_method: string;
  customer: { name: string; phone: string } | null;
  items: OrderItem[];
  created_at: string;
  notes: string | null;
}

const COLUMNS: { status: OrderStatus; label: string; color: string; badge: string }[] = [
  { status: "pending",    label: "En attente",   color: "border-t-yellow-400", badge: "bg-yellow-100 text-yellow-800" },
  { status: "confirmed",  label: "Confirmé",     color: "border-t-blue-400",   badge: "bg-blue-100 text-blue-800" },
  { status: "preparing",  label: "Préparation",  color: "border-t-orange-400", badge: "bg-orange-100 text-orange-800" },
  { status: "ready",      label: "Prêt",         color: "border-t-purple-400", badge: "bg-purple-100 text-purple-800" },
  { status: "delivering", label: "En livraison", color: "border-t-cyan-400",   badge: "bg-cyan-100 text-cyan-800" },
  { status: "delivered",  label: "Livré",        color: "border-t-green-400",  badge: "bg-green-100 text-green-800" },
  { status: "cancelled",  label: "Annulé",       color: "border-t-red-400",    badge: "bg-red-100 text-red-800" },
];

const TRANSITIONS: Record<OrderStatus, OrderStatus | null> = {
  pending:    "confirmed",
  confirmed:  "preparing",
  preparing:  "ready",
  ready:      "delivering",
  delivering: "delivered",
  delivered:  null,
  cancelled:  null,
};

const TRANSITION_LABELS: Record<OrderStatus, string> = {
  pending:    "Confirmer",
  confirmed:  "Démarrer prépa.",
  preparing:  "Marquer prêt",
  ready:      "En livraison",
  delivering: "Livré",
  delivered:  "",
  cancelled:  "",
};

function timeAgo(iso: string) {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (diff < 1) return "à l'instant";
  if (diff < 60) return `il y a ${diff} min`;
  return `il y a ${Math.floor(diff / 60)}h`;
}

export default function BranchOrdersPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Order | null>(null);
  const [qrInput, setQrInput] = useState("");
  const [showQrScan, setShowQrScan] = useState(false);

  const { data: orders = [], isLoading } = useQuery<Order[]>({
    queryKey: ["branch-orders"],
    queryFn:  () => branchApiGet("/orders", { limit: 200 }),
    refetchInterval: 30_000,
    select: (d: any) => (Array.isArray(d) ? d : d?.data ?? []),
  });

  const advanceMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      branchApiPatch(`/orders/${id}/status`, { status }),
    onSuccess: (_, { status }) => {
      toast.success(`Commande → ${status}`);
      qc.invalidateQueries({ queryKey: ["branch-orders"] });
      setSelected(null);
    },
    onError: () => toast.error("Mise à jour échouée"),
  });

  const scanMutation = useMutation({
    mutationFn: (qr_code: string) => branchApiPost("/collect/scan", { qr_code }),
    onSuccess: (data: any) => {
      toast.success(`Retrait validé — ${data?.customer?.name ?? "Client"}`);
      qc.invalidateQueries({ queryKey: ["branch-orders"] });
      setShowQrScan(false);
      setQrInput("");
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.error?.message ?? "QR invalide ou commande non prête";
      toast.error(msg);
    },
  });

  const cancelMutation = useMutation({
    mutationFn: (id: string) => branchApiPatch(`/orders/${id}/status`, { status: "cancelled" }),
    onSuccess: () => {
      toast.success("Commande annulée");
      qc.invalidateQueries({ queryKey: ["branch-orders"] });
      setSelected(null);
    },
    onError: () => toast.error("Annulation échouée"),
  });

  const filtered = orders.filter((o) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (
      o.id.slice(-6).toLowerCase().includes(s) ||
      o.customer?.name?.toLowerCase().includes(s) ||
      o.customer?.phone?.includes(s)
    );
  });

  const byStatus = (status: OrderStatus) => filtered.filter((o) => o.status === status);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Commandes</h1>
          <p className="text-sm text-slate-500 mt-0.5">Kanban en temps réel</p>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setShowQrScan(true)}>
            <QrCode className="h-4 w-4" />Scanner QR
          </Button>
          <div className="relative w-56">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Chercher..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 text-sm"
            />
          </div>
        </div>
      </div>

      {/* Kanban board */}
      <div className="flex gap-3 overflow-x-auto pb-4">
        {COLUMNS.map((col) => {
          const colOrders = byStatus(col.status);
          return (
            <div key={col.status} className="flex-shrink-0 w-64">
              <div className={`bg-white rounded-xl border-t-4 ${col.color} shadow-sm`}>
                <div className="px-3 py-2.5 flex items-center justify-between border-b border-slate-100">
                  <span className="text-xs font-semibold text-slate-700 uppercase tracking-wider">{col.label}</span>
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${col.badge}`}>{colOrders.length}</span>
                </div>
                <div className="p-2 space-y-2 min-h-[120px] max-h-[calc(100vh-260px)] overflow-y-auto">
                  {isLoading
                    ? Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-24 w-full rounded-lg" />)
                    : colOrders.map((order) => (
                        <button
                          key={order.id}
                          onClick={() => setSelected(order)}
                          className="w-full text-left bg-slate-50 hover:bg-brand-50 border border-slate-200 hover:border-brand-200 rounded-lg p-3 transition-all group"
                        >
                          <div className="flex items-start justify-between mb-1.5">
                            <span className="text-xs font-bold text-slate-800">#{order.id.slice(-6).toUpperCase()}</span>
                            <ChevronRight className="h-3 w-3 text-slate-400 group-hover:text-brand-500 mt-0.5" />
                          </div>
                          <p className="text-xs text-slate-600 truncate">{order.customer?.name ?? "Client anonyme"}</p>
                          <div className="flex items-center justify-between mt-2">
                            <span className="text-sm font-bold text-slate-900">{formatCurrency(order.total_amount)}</span>
                            <span className="flex items-center gap-1 text-[10px] text-slate-400">
                              <Clock className="h-3 w-3" />{timeAgo(order.created_at)}
                            </span>
                          </div>
                        </button>
                      ))
                  }
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* QR Scan dialog */}
      <Dialog open={showQrScan} onOpenChange={(o) => { setShowQrScan(o); if (!o) setQrInput(""); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ScanLine className="h-5 w-5 text-brand-600" />
              Scanner le QR Click & Collect
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="rounded-xl bg-brand-50 border border-brand-100 p-4 text-center">
              <QrCode className="h-12 w-12 text-brand-400 mx-auto mb-2" />
              <p className="text-xs text-slate-500">Scannez le QR code du client ou saisissez le code à 6 chiffres</p>
            </div>
            <Input
              placeholder="Code QR ou code numérique à 6 chiffres"
              value={qrInput}
              onChange={(e) => setQrInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && qrInput.trim()) scanMutation.mutate(qrInput.trim()); }}
              autoFocus
              className="text-center text-lg tracking-widest font-mono"
            />
            <Button
              className="w-full bg-brand-600 hover:bg-brand-700"
              disabled={!qrInput.trim() || scanMutation.isPending}
              onClick={() => scanMutation.mutate(qrInput.trim())}
            >
              {scanMutation.isPending ? "Vérification..." : "Valider le retrait"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Order detail dialog */}
      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-md">
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center justify-between">
                  <span>Commande #{selected.id.slice(-6).toUpperCase()}</span>
                  <Badge className={COLUMNS.find((c) => c.status === selected.status)?.badge ?? ""}>
                    {COLUMNS.find((c) => c.status === selected.status)?.label}
                  </Badge>
                </DialogTitle>
              </DialogHeader>

              <div className="space-y-4">
                {/* Customer */}
                <div className="rounded-lg bg-slate-50 p-3">
                  <p className="text-xs font-semibold text-slate-500 uppercase mb-1">Client</p>
                  <p className="text-sm font-medium text-slate-800">{selected.customer?.name ?? "—"}</p>
                  <p className="text-xs text-slate-500">{selected.customer?.phone ?? "—"}</p>
                </div>

                {/* Items */}
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase mb-2">Articles</p>
                  <div className="space-y-1.5">
                    {selected.items?.map((item, i) => (
                      <div key={i} className="flex items-center justify-between text-sm">
                        <span className="text-slate-700">{item.quantity}× {item.name_fr}</span>
                        <span className="font-medium text-slate-900">{formatCurrency(item.unit_price * item.quantity)}</span>
                      </div>
                    ))}
                  </div>
                  <div className="border-t border-slate-200 mt-2 pt-2 flex justify-between text-sm font-bold">
                    <span>Total</span>
                    <span>{formatCurrency(selected.total_amount)}</span>
                  </div>
                  {selected.delivery_fee > 0 && (
                    <div className="flex justify-between text-xs text-slate-500 mt-1">
                      <span>Frais livraison</span>
                      <span>{formatCurrency(selected.delivery_fee)}</span>
                    </div>
                  )}
                </div>

                {/* Notes */}
                {selected.notes && (
                  <div className="rounded-lg bg-yellow-50 border border-yellow-200 p-3">
                    <p className="text-xs font-semibold text-yellow-700 mb-1">Note client</p>
                    <p className="text-sm text-yellow-800">{selected.notes}</p>
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-2 pt-1">
                  {TRANSITIONS[selected.status] && (
                    <Button
                      className="flex-1 bg-brand-600 hover:bg-brand-700"
                      disabled={advanceMutation.isPending}
                      onClick={() => advanceMutation.mutate({ id: selected.id, status: TRANSITIONS[selected.status]! })}
                    >
                      {advanceMutation.isPending ? "..." : TRANSITION_LABELS[selected.status]}
                    </Button>
                  )}
                  {!["delivered", "cancelled"].includes(selected.status) && (
                    <Button
                      variant="outline"
                      className="border-red-200 text-red-600 hover:bg-red-50"
                      disabled={cancelMutation.isPending}
                      onClick={() => cancelMutation.mutate(selected.id)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
