"use client";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { use } from "react";
import { api } from "@/lib/api";
import { apiGet } from "@/lib/api";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";
import { Megaphone, CheckCircle, XCircle, Users, Banknote, Building2 } from "lucide-react";
import Image from "next/image";

interface Ad {
  id: string; title: string; image_url: string; target_count: number;
  amount_paid: number; status: string; impressions_count: number;
  rejection_reason: string | null; created_at: string;
  brands: { id: string; name: string; logo_url: string | null };
}

const STATUS_BADGE: Record<string, { variant: any; label: string }> = {
  pending:  { variant: "pending",   label: "En attente" },
  active:   { variant: "delivered", label: "Active" },
  expired:  { variant: "default",   label: "Expirée" },
  rejected: { variant: "cancelled", label: "Rejetée" },
};

export default function SuperAdminAdsPage({ params }: { params: Promise<{ locale: string }> }) {
  use(params);
  const qc = useQueryClient();
  const [statusFilter, setStatusFilter] = useState("pending");
  const [rejectModal, setRejectModal] = useState<{ open: boolean; adId: string }>({ open: false, adId: "" });
  const [reason, setReason] = useState("");
  const [previewAd, setPreviewAd] = useState<Ad | null>(null);

  const { data: ads, isLoading } = useQuery<Ad[]>({
    queryKey: ["superadmin-ads", statusFilter],
    queryFn: () => apiGet("/ads/superadmin/all", { status: statusFilter }),
  });

  const approveMutation = useMutation({
    mutationFn: (id: string) => api.patch(`/ads/superadmin/${id}/approve`),
    onSuccess: () => { toast.success("Publicité approuvée et activée"); qc.invalidateQueries({ queryKey: ["superadmin-ads"] }); },
    onError: (e: any) => toast.error(e?.response?.data?.error?.message ?? "Erreur"),
  });

  const rejectMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      api.patch(`/ads/superadmin/${id}/reject`, { reason }),
    onSuccess: () => {
      toast.success("Publicité rejetée — marque remboursée");
      qc.invalidateQueries({ queryKey: ["superadmin-ads"] });
      setRejectModal({ open: false, adId: "" });
      setReason("");
    },
    onError: (e: any) => toast.error(e?.response?.data?.error?.message ?? "Erreur"),
  });

  const pending = ads?.filter((a) => a.status === "pending").length ?? 0;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Megaphone className="h-6 w-6 text-brand-600" /> Modération des publicités
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {pending > 0 ? `${pending} pub${pending > 1 ? "s" : ""} en attente de validation` : "Aucune pub en attente"}
          </p>
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="pending">En attente</SelectItem>
            <SelectItem value="active">Actives</SelectItem>
            <SelectItem value="expired">Expirées</SelectItem>
            <SelectItem value="rejected">Rejetées</SelectItem>
            <SelectItem value="all">Toutes</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold text-slate-700">Publicités</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-5 space-y-3">{[1,2,3].map((i) => <Skeleton key={i} className="h-24 w-full" />)}</div>
          ) : !ads?.length ? (
            <div className="flex flex-col items-center justify-center py-16 text-slate-400">
              <Megaphone className="h-10 w-10 mb-3 opacity-30" />
              <p className="text-slate-600 font-medium">Aucune publicité</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {ads.map((ad) => {
                const s = STATUS_BADGE[ad.status] ?? STATUS_BADGE.pending;
                return (
                  <div key={ad.id} className="flex items-center gap-4 px-5 py-4 hover:bg-slate-50 transition-colors">
                    {/* Image */}
                    <button
                      type="button"
                      onClick={() => setPreviewAd(ad)}
                      className="h-20 w-32 shrink-0 rounded-lg overflow-hidden bg-slate-100 border border-slate-200 cursor-pointer hover:opacity-90 transition-opacity"
                    >
                      <Image src={ad.image_url} alt={ad.title} width={128} height={80} className="h-full w-full object-cover" />
                    </button>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <p className="font-semibold text-slate-900 truncate">{ad.title}</p>
                        <Badge variant={s.variant}>{s.label}</Badge>
                      </div>
                      <div className="flex items-center gap-1.5 mb-1">
                        <Building2 className="h-3 w-3 text-slate-400" />
                        <p className="text-sm text-slate-600 font-medium">{ad.brands?.name}</p>
                      </div>
                      <div className="flex items-center gap-4 text-xs text-slate-400">
                        <span className="flex items-center gap-1"><Users className="h-3 w-3" />{ad.impressions_count}/{ad.target_count} utilisateurs</span>
                        <span className="flex items-center gap-1"><Banknote className="h-3 w-3" />{formatCurrency(ad.amount_paid)}</span>
                        <span>{formatDateTime(ad.created_at)}</span>
                      </div>
                      {ad.rejection_reason && (
                        <p className="text-xs text-red-600 mt-1">Motif : {ad.rejection_reason}</p>
                      )}
                    </div>

                    {/* Actions */}
                    {ad.status === "pending" && (
                      <div className="flex gap-2 shrink-0">
                        <Button
                          size="sm" variant="success"
                          onClick={() => approveMutation.mutate(ad.id)}
                          disabled={approveMutation.isPending}
                          className="gap-1.5"
                        >
                          <CheckCircle className="h-3.5 w-3.5" /> Approuver
                        </Button>
                        <Button
                          size="sm" variant="destructive"
                          onClick={() => setRejectModal({ open: true, adId: ad.id })}
                          className="gap-1.5"
                        >
                          <XCircle className="h-3.5 w-3.5" /> Rejeter
                        </Button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Preview modale */}
      <Dialog open={!!previewAd} onOpenChange={(v) => { if (!v) setPreviewAd(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{previewAd?.title}</DialogTitle>
          </DialogHeader>
          {previewAd && (
            <div className="space-y-3">
              <img src={previewAd.image_url} alt={previewAd.title} className="w-full rounded-lg object-contain max-h-80" />
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-lg bg-slate-50 p-3">
                  <p className="text-slate-500 text-xs">Marque</p>
                  <p className="font-semibold text-slate-900">{previewAd.brands?.name}</p>
                </div>
                <div className="rounded-lg bg-slate-50 p-3">
                  <p className="text-slate-500 text-xs">Audience cible</p>
                  <p className="font-semibold text-slate-900">{previewAd.target_count} utilisateurs</p>
                </div>
                <div className="rounded-lg bg-brand-50 p-3">
                  <p className="text-slate-500 text-xs">Montant payé</p>
                  <p className="font-semibold text-brand-700">{formatCurrency(previewAd.amount_paid)}</p>
                </div>
                <div className="rounded-lg bg-slate-50 p-3">
                  <p className="text-slate-500 text-xs">Impressions</p>
                  <p className="font-semibold text-slate-900">{previewAd.impressions_count}</p>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Rejet modale */}
      <Dialog open={rejectModal.open} onOpenChange={(v) => setRejectModal((p) => ({ ...p, open: v }))}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Motif du rejet</DialogTitle>
          </DialogHeader>
          <div className="space-y-1.5 py-2">
            <Label>Expliquez pourquoi cette pub est rejetée</Label>
            <textarea
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Ex: Contenu inapproprié, image de mauvaise qualité..."
              className="flex w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand-500 resize-none"
            />
            <p className="text-xs text-slate-400">La marque sera automatiquement remboursée.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectModal({ open: false, adId: "" })}>Annuler</Button>
            <Button
              variant="destructive"
              disabled={reason.trim().length < 5 || rejectMutation.isPending}
              onClick={() => rejectMutation.mutate({ id: rejectModal.adId, reason })}
            >
              {rejectMutation.isPending ? <Spinner size="sm" /> : "Confirmer le rejet"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
