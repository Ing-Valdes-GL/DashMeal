"use client";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { apiGet, apiPatch, apiPost } from "@/lib/api";
import { formatDateTime, formatCurrency } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Pagination } from "@/components/ui/pagination";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { RefreshCw, MoreHorizontal, Truck, MapPin, User } from "lucide-react";

interface Delivery {
  id: string; status: string; address: string; started_at: string | null; delivered_at: string | null;
  orders: { id: string; total: number; users: { name: string; phone: string }; branches: { name: string } };
  drivers: { name: string; phone: string } | null;
}
interface Driver { id: string; name: string; phone: string }

const STATUS_VARIANT: Record<string, any> = {
  assigned: "info", picked_up: "preparing", on_the_way: "delivering",
  delivered: "delivered", failed: "cancelled",
};

const DELIVERY_STATUSES = ["assigned", "picked_up", "on_the_way", "delivered", "failed"];

export default function DeliveryPage() {
  const t = useTranslations("delivery");
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState("all");
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [selected, setSelected] = useState<Delivery | null>(null);
  const [newStatus, setNewStatus] = useState("");

  const { data, isLoading, refetch } = useQuery<{ data: Delivery[]; pagination: any }>({
    queryKey: ["deliveries", { page, statusFilter }],
    queryFn: () => apiGet("/delivery", {
      page, limit: 20,
      ...(statusFilter !== "all" && { status: statusFilter }),
    }) as any,
  });

  const { data: drivers } = useQuery<Driver[]>({
    queryKey: ["drivers"],
    queryFn: () => apiGet("/admins/drivers"),
    enabled: showAssignModal,
  });

  const assignMutation = useMutation({
    mutationFn: ({ deliveryId, driver_id }: { deliveryId: string; driver_id: string }) =>
      apiPost(`/orders/${selected?.orders.id}/assign-driver`, { driver_id }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["deliveries"] }); toast.success("Livreur assigné"); setShowAssignModal(false); },
    onError: () => toast.error("Erreur"),
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      apiPatch(`/delivery/${id}/status`, { status }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["deliveries"] }); toast.success("Statut mis à jour"); setShowStatusModal(false); },
    onError: () => toast.error("Erreur"),
  });

  const deliveries = data?.data ?? [];

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{t("title")}</h1>
          <p className="text-sm text-slate-400">{t("subtitle")}</p>
        </div>
        <div className="flex gap-2">
          <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1); }}>
            <SelectTrigger className="w-40"><SelectValue placeholder="Statut" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous</SelectItem>
              {DELIVERY_STATUSES.map((s) => (
                <SelectItem key={s} value={s}>{t(s as any)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={() => refetch()}><RefreshCw className="h-4 w-4" /></Button>
        </div>
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Commande</TableHead>
              <TableHead>Client</TableHead>
              <TableHead>Livreur</TableHead>
              <TableHead>{t("address")}</TableHead>
              <TableHead>{t("status")}</TableHead>
              <TableHead>Date</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading
              ? Array.from({ length: 8 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 7 }).map((_, j) => (
                      <TableCell key={j}><Skeleton className="h-5 w-full" /></TableCell>
                    ))}
                  </TableRow>
                ))
              : deliveries.map((d) => (
                  <TableRow key={d.id}>
                    <TableCell>
                      <div>
                        <p className="font-mono text-xs text-slate-500">#{d.id.slice(0, 8)}</p>
                        <p className="text-sm font-semibold text-slate-900">{formatCurrency(d.orders?.total)}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="text-slate-900 font-medium">{d.orders?.users?.name}</p>
                        <p className="text-xs text-slate-500">{d.orders?.users?.phone}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      {d.drivers ? (
                        <div className="flex items-center gap-2">
                          <div className="h-7 w-7 rounded-full bg-brand-500/20 flex items-center justify-center text-brand-400 text-xs font-bold">
                            {d.drivers.name.slice(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <p className="text-sm text-slate-900">{d.drivers.name}</p>
                            <p className="text-xs text-slate-500">{d.drivers.phone}</p>
                          </div>
                        </div>
                      ) : (
                        <span className="text-xs text-slate-500 italic">Non assigné</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5 text-sm text-slate-400 max-w-[180px]">
                        <MapPin className="h-3.5 w-3.5 shrink-0 text-slate-600" />
                        <span className="truncate">{d.address}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={STATUS_VARIANT[d.status]}>{t(d.status as any)}</Badge>
                    </TableCell>
                    <TableCell className="text-xs text-slate-500">
                      {d.delivered_at ? formatDateTime(d.delivered_at)
                        : d.started_at ? formatDateTime(d.started_at)
                        : "—"}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon-sm"><MoreHorizontal className="h-4 w-4" /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {!d.drivers && (
                            <DropdownMenuItem onClick={() => { setSelected(d); setShowAssignModal(true); }}>
                              <User className="mr-2 h-4 w-4" />{t("assignDriver")}
                            </DropdownMenuItem>
                          )}
                          {!["delivered", "failed"].includes(d.status) && (
                            <DropdownMenuItem onClick={() => { setSelected(d); setNewStatus(d.status); setShowStatusModal(true); }}>
                              <Truck className="mr-2 h-4 w-4" />{t("updateStatus")}
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
          </TableBody>
        </Table>
        {data?.pagination && (
          <div className="p-4 border-t border-slate-200">
            <Pagination page={data.pagination.page} totalPages={data.pagination.total_pages}
              total={data.pagination.total} limit={data.pagination.limit} onPageChange={setPage} />
          </div>
        )}
      </Card>

      {/* Modal assigner livreur */}
      <Dialog open={showAssignModal} onOpenChange={setShowAssignModal}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t("assignDriver")}</DialogTitle></DialogHeader>
          <div className="space-y-2">
            {(drivers ?? []).map((d) => (
              <button key={d.id}
                className="w-full flex items-center gap-3 rounded-lg border border-slate-300 p-3 hover:border-brand-500 hover:bg-brand-500/10 transition-colors text-left"
                onClick={() => assignMutation.mutate({ deliveryId: selected!.id, driver_id: d.id })}>
                <div className="h-8 w-8 rounded-full bg-brand-500/20 flex items-center justify-center text-brand-400 text-xs font-bold">
                  {d.name.slice(0, 2).toUpperCase()}
                </div>
                <div><p className="text-slate-900 font-medium">{d.name}</p><p className="text-xs text-slate-500">{d.phone}</p></div>
              </button>
            ))}
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setShowAssignModal(false)}>Annuler</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal update statut */}
      <Dialog open={showStatusModal} onOpenChange={setShowStatusModal}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t("updateStatus")}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Select value={newStatus} onValueChange={setNewStatus}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {DELIVERY_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>{t(s as any)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowStatusModal(false)}>Annuler</Button>
            <Button onClick={() => statusMutation.mutate({ id: selected!.id, status: newStatus })}
              disabled={statusMutation.isPending}>Confirmer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
