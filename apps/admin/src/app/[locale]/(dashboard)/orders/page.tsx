"use client";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { apiGet, apiPatch, apiPost } from "@/lib/api";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Pagination } from "@/components/ui/pagination";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Search, RefreshCw, MoreHorizontal, Eye, Truck, CheckSquare, X, QrCode, Download } from "lucide-react";
import QRCodeSVG from "react-qr-code";

interface Order {
  id: string; total: number; status: string; type: string;
  created_at: string; notes: string | null;
  users: { name: string; phone: string };
  branches: { name: string };
  order_items?: { quantity: number; unit_price: number; products: { name_fr: string } }[];
}
interface Driver { id: string; name: string; phone: string }

const STATUS_OPTIONS = ["all", "pending", "confirmed", "preparing", "ready", "delivering", "delivered", "cancelled"];
const STATUS_VARIANT: Record<string, any> = {
  pending: "pending", confirmed: "confirmed", preparing: "preparing",
  ready: "ready", delivering: "delivering", delivered: "delivered", cancelled: "cancelled",
};
const NEXT_STATUSES: Record<string, string[]> = {
  pending:    ["confirmed", "cancelled"],
  confirmed:  ["preparing", "cancelled"],
  preparing:  ["ready", "cancelled"],
  ready:      ["delivering", "delivered"],
  delivering: ["delivered", "failed"],
};

export default function OrdersPage() {
  const t = useTranslations("orders");
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("all");
  const [search, setSearch] = useState("");
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [showDetail, setShowDetail] = useState(false);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [showDriverModal, setShowDriverModal] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState("");

  const { data, isLoading, refetch } = useQuery<{ data: Order[]; pagination: any }>({
    queryKey: ["orders", { page, status, search }],
    queryFn: () =>
      apiGet("/orders", {
        page, limit: 20,
        ...(status !== "all" && { status }),
        ...(search && { search }),
      }) as any,
    staleTime: 0,
  });

  const { data: drivers } = useQuery<Driver[]>({
    queryKey: ["drivers"],
    queryFn: () => apiGet("/admins/drivers"),
    enabled: showDriverModal,
  });

  // QR code collect
  const isConfirmedCollect = !!(
    selectedOrder?.type === "collect" &&
    ["confirmed", "preparing", "ready", "delivering", "delivered"].includes(selectedOrder?.status ?? "")
  );
  const { data: collectQr } = useQuery<{
    qr_code: string; pickup_status: string;
    time_slots: { date: string; start_time: string; end_time: string };
  }>({
    queryKey: ["collect-qr", selectedOrder?.id],
    queryFn: () => apiGet(`/collect/admin/order/${selectedOrder!.id}`),
    enabled: isConfirmedCollect && showDetail,
    staleTime: Infinity,
  });

  const downloadCollectQr = () => {
    const svg = document.getElementById("order-detail-qr-svg");
    if (!svg || !selectedOrder) return;
    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement("canvas");
    canvas.width = 300; canvas.height = 360;
    const ctx = canvas.getContext("2d");
    const img = new Image();
    const blob = new Blob([svgData], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    img.onload = () => {
      if (!ctx) return;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, 300, 360);
      ctx.drawImage(img, 25, 20, 250, 250);
      ctx.fillStyle = "#111827";
      ctx.font = "bold 26px monospace";
      ctx.textAlign = "center";
      ctx.fillText(selectedOrder.users?.name ?? "", 150, 300);
      ctx.font = "13px sans-serif";
      ctx.fillStyle = "#6b7280";
      ctx.fillText(`Commande #${selectedOrder.id.slice(0, 8)}`, 150, 325);
      ctx.fillText(`${collectQr?.time_slots?.date ?? ""} ${collectQr?.time_slots?.start_time ?? ""}`, 150, 348);
      URL.revokeObjectURL(url);
      const link = document.createElement("a");
      link.download = `qr-collect-${selectedOrder.id.slice(0, 8)}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
    };
    img.src = url;
  };

  // Mutation : update status
  const updateStatus = useMutation({
    mutationFn: ({ id, status, note }: { id: string; status: string; note?: string }) =>
      apiPatch(`/orders/${id}/status`, { status, note }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["orders"] });
      toast.success(t("updateStatus"), "Statut mis à jour");
      setShowStatusModal(false);
    },
    onError: () => toast.error("Erreur", "Impossible de mettre à jour le statut"),
  });

  // Mutation : assign driver
  const assignDriver = useMutation({
    mutationFn: ({ id, driver_id }: { id: string; driver_id: string }) =>
      apiPost(`/orders/${id}/assign-driver`, { driver_id }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["orders"] });
      toast.success(t("assignDriver"), "Livreur assigné");
      setShowDriverModal(false);
    },
    onError: () => toast.error("Erreur", "Impossible d'assigner le livreur"),
  });

  const orders = data?.data ?? [];
  const pagination = data?.pagination;

  return (
    <div className="space-y-5 animate-fade-in">
      {/* En-tête */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{t("title")}</h1>
          <p className="text-sm text-slate-400">{t("subtitle")}</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      {/* Filtres */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
              <Input
                placeholder={`${t("customer")} ou #ID...`}
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                className="pl-9"
              />
            </div>
            <Tabs value={status} onValueChange={(v) => { setStatus(v); setPage(1); }}>
              <TabsList className="flex-wrap h-auto gap-1">
                {STATUS_OPTIONS.map((s) => (
                  <TabsTrigger key={s} value={s} className="text-xs">
                    {s === "all" ? "Tout" : t(s as any)}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("orderId")}</TableHead>
              <TableHead>{t("customer")}</TableHead>
              <TableHead>{t("branch")}</TableHead>
              <TableHead>{t("type")}</TableHead>
              <TableHead>{t("status")}</TableHead>
              <TableHead>{t("total")}</TableHead>
              <TableHead>{t("date")}</TableHead>
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
              : orders.map((order) => (
                  <TableRow key={order.id}>
                    <TableCell className="font-mono text-xs text-slate-500">
                      #{order.id.slice(0, 8)}
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium text-slate-900">{order.users?.name}</p>
                        <p className="text-xs text-slate-500">{order.users?.phone}</p>
                      </div>
                    </TableCell>
                    <TableCell className="text-slate-700">{order.branches?.name}</TableCell>
                    <TableCell>
                      <Badge variant={order.type === "collect" ? "collect" : "delivery"}>
                        {order.type === "collect" ? t("collect") : t("delivery")}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={STATUS_VARIANT[order.status]}>
                        {t(order.status as any)}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-semibold text-slate-900">
                      {formatCurrency(order.total)}
                    </TableCell>
                    <TableCell className="text-xs text-slate-500">
                      {formatDateTime(order.created_at)}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon-sm">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => { setSelectedOrder(order); setShowDetail(true); }}>
                            <Eye className="mr-2 h-4 w-4" /> {t("viewDetails")}
                          </DropdownMenuItem>
                          {NEXT_STATUSES[order.status] && (
                            <DropdownMenuItem onClick={() => { setSelectedOrder(order); setShowStatusModal(true); }}>
                              <CheckSquare className="mr-2 h-4 w-4" /> {t("updateStatus")}
                            </DropdownMenuItem>
                          )}
                          {order.type === "delivery" && order.status === "confirmed" && (
                            <DropdownMenuItem onClick={() => { setSelectedOrder(order); setShowDriverModal(true); }}>
                              <Truck className="mr-2 h-4 w-4" /> {t("assignDriver")}
                            </DropdownMenuItem>
                          )}
                          {["pending", "confirmed"].includes(order.status) && (
                            <DropdownMenuItem
                              destructive
                              onClick={() => { setSelectedOrder(order); setCancelReason(""); setShowCancelModal(true); }}
                            >
                              <X className="mr-2 h-4 w-4" /> Annuler la commande
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
          </TableBody>
        </Table>
        {pagination && (
          <div className="p-4 border-t border-slate-200">
            <Pagination
              page={pagination.page}
              totalPages={pagination.total_pages}
              total={pagination.total}
              limit={pagination.limit}
              onPageChange={setPage}
            />
          </div>
        )}
      </Card>

      {/* Modal : Détail commande */}
      <Dialog open={showDetail} onOpenChange={setShowDetail}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>{t("orderDetail")}</DialogTitle>
          </DialogHeader>
          {selectedOrder && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><p className="text-slate-500">Client</p><p className="text-slate-900 font-medium">{selectedOrder.users?.name}</p></div>
                <div><p className="text-slate-500">Téléphone</p><p className="text-slate-900">{selectedOrder.users?.phone}</p></div>
                <div><p className="text-slate-500">Agence</p><p className="text-slate-900">{selectedOrder.branches?.name}</p></div>
                <div><p className="text-slate-500">Type</p>
                  <Badge variant={selectedOrder.type === "collect" ? "collect" : "delivery"}>
                    {selectedOrder.type === "collect" ? t("collect") : t("delivery")}
                  </Badge>
                </div>
                <div><p className="text-slate-500">Statut</p><Badge variant={STATUS_VARIANT[selectedOrder.status]}>{t(selectedOrder.status as any)}</Badge></div>
                <div><p className="text-slate-500">Total</p><p className="text-slate-900 font-bold">{formatCurrency(selectedOrder.total)}</p></div>
              </div>
              {selectedOrder.notes && (
                <div className="rounded-lg bg-slate-100 p-3 text-sm text-slate-700">
                  <p className="text-xs text-slate-500 mb-1">Note</p>
                  {selectedOrder.notes}
                </div>
              )}

              {/* ── QR Code Click & Collect ── */}
              {selectedOrder.type === "collect" && (
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                    <QrCode className="h-3.5 w-3.5" /> QR Code de retrait
                  </p>

                  {!isConfirmedCollect ? (
                    <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-700">
                      <QrCode className="h-4 w-4 shrink-0" />
                      Le QR code sera disponible après confirmation du paiement.
                    </div>
                  ) : !collectQr ? (
                    <div className="flex items-center justify-center py-8">
                      <div className="h-5 w-5 border-2 border-slate-300 border-t-brand-500 rounded-full animate-spin" />
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-4">
                      {/* Infos créneau */}
                      {collectQr.time_slots && (
                        <p className="text-xs text-slate-500">
                          Créneau : <span className="font-semibold text-slate-700">
                            {collectQr.time_slots.date} · {collectQr.time_slots.start_time} – {collectQr.time_slots.end_time}
                          </span>
                        </p>
                      )}

                      {/* QR SVG */}
                      <div className="bg-white rounded-xl p-4 border border-slate-200">
                        <QRCodeSVG
                          id="order-detail-qr-svg"
                          value={collectQr.qr_code}
                          size={180}
                          bgColor="#ffffff"
                          fgColor="#111827"
                        />
                      </div>

                      {/* Statut retrait */}
                      <Badge variant={collectQr.pickup_status === "picked_up" ? "delivered" : "pending"}>
                        {collectQr.pickup_status === "picked_up" ? "Déjà récupérée" : "En attente de retrait"}
                      </Badge>

                      {/* Bouton télécharger */}
                      <Button variant="outline" size="sm" className="w-full gap-2" onClick={downloadCollectQr}>
                        <Download className="h-4 w-4" />
                        Télécharger le QR code
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDetail(false)}>Fermer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal : Mise à jour statut */}
      <Dialog open={showStatusModal} onOpenChange={setShowStatusModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("updateStatus")}</DialogTitle>
          </DialogHeader>
          {selectedOrder && (
            <StatusForm
              order={selectedOrder}
              nextStatuses={NEXT_STATUSES[selectedOrder.status] ?? []}
              onSubmit={(status, note) => updateStatus.mutate({ id: selectedOrder.id, status, note })}
              loading={updateStatus.isPending}
              onCancel={() => setShowStatusModal(false)}
              t={t}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Modal : Confirmation annulation */}
      <Dialog open={showCancelModal} onOpenChange={(open) => { setShowCancelModal(open); if (!open) setCancelReason(""); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-red-600 flex items-center gap-2">
              <X className="h-5 w-5" /> Annuler la commande
            </DialogTitle>
          </DialogHeader>
          {selectedOrder && (
            <div className="space-y-4 pt-1">
              <p className="text-sm text-slate-600">
                Vous êtes sur le point d&apos;annuler la commande{" "}
                <span className="font-mono font-semibold">#{selectedOrder.id.slice(0, 8)}</span>{" "}
                de <span className="font-semibold">{selectedOrder.users?.name}</span>.
              </p>
              <div className="space-y-1.5">
                <Label>
                  Motif d&apos;annulation <span className="text-red-500">*</span>
                </Label>
                <Textarea
                  placeholder="Ex : Client injoignable, rupture de stock…"
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  rows={3}
                />
                {cancelReason.trim().length === 0 && (
                  <p className="text-xs text-red-400">Un motif est obligatoire</p>
                )}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowCancelModal(false)}>Annuler</Button>
                <Button
                  variant="destructive"
                  disabled={cancelReason.trim().length === 0 || updateStatus.isPending}
                  onClick={() => {
                    updateStatus.mutate(
                      { id: selectedOrder.id, status: "cancelled", note: cancelReason.trim() },
                      { onSuccess: () => { setShowCancelModal(false); setCancelReason(""); } }
                    );
                  }}
                >
                  {updateStatus.isPending ? "Annulation…" : "Confirmer l'annulation"}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Modal : Assigner livreur */}
      <Dialog open={showDriverModal} onOpenChange={setShowDriverModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("assignDriver")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {drivers?.map((d) => (
              <button
                key={d.id}
                className="w-full flex items-center gap-3 rounded-lg border border-slate-300 bg-slate-100 p-3 hover:border-brand-500 hover:bg-brand-500/10 transition-colors text-left"
                onClick={() => assignDriver.mutate({ id: selectedOrder!.id, driver_id: d.id })}
              >
                <div className="h-9 w-9 rounded-full bg-brand-500/20 flex items-center justify-center text-brand-400 font-bold text-sm">
                  {d.name.slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <p className="text-slate-900 font-medium">{d.name}</p>
                  <p className="text-xs text-slate-500">{d.phone}</p>
                </div>
              </button>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDriverModal(false)}>Annuler</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StatusForm({ order, nextStatuses, onSubmit, loading, onCancel, t }: {
  order: Order; nextStatuses: string[]; loading: boolean;
  onSubmit: (status: string, note?: string) => void;
  onCancel: () => void; t: ReturnType<typeof useTranslations>;
}) {
  const [status, setStatus] = useState(nextStatuses[0] ?? "");
  const [note, setNote] = useState("");
  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm text-slate-400 mb-1">Statut actuel : <Badge variant={STATUS_VARIANT[order.status]}>{t(order.status as any)}</Badge></p>
      </div>
      <div className="space-y-1.5">
        <Label>Nouveau statut</Label>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {nextStatuses.map((s) => (
              <SelectItem key={s} value={s}>{t(s as any)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label>{t("note")} <span className="text-slate-500 text-xs">(optionnel)</span></Label>
        <Textarea placeholder={t("notePlaceholder")} value={note} onChange={(e) => setNote(e.target.value)} rows={2} />
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onCancel}>Annuler</Button>
        <Button onClick={() => onSubmit(status, note || undefined)} disabled={!status || loading}>
          {loading ? "..." : "Confirmer"}
        </Button>
      </DialogFooter>
    </div>
  );
}
