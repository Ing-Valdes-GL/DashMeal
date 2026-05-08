"use client";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPost } from "@/lib/api";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  ShieldCheck, Clock, CheckCircle2, XCircle, FileText,
  ExternalLink, RefreshCw, Eye, AlertCircle, User,
} from "lucide-react";

interface DriverDoc {
  id: string;
  type: string;
  url: string;
  status: string;
  created_at: string;
}

interface DriverKyc {
  id: string;
  name: string;
  phone: string;
  kyc_status: "pending" | "submitted" | "approved" | "rejected";
  documents?: DriverDoc[];
  submitted_at?: string | null;
  created_at: string;
}

const KYC_STATUS_STYLE: Record<string, string> = {
  pending:   "border-slate-500/30 bg-slate-500/10 text-slate-400",
  submitted: "border-blue-500/30 bg-blue-500/10 text-blue-400",
  approved:  "border-green-500/30 bg-green-500/10 text-green-400",
  rejected:  "border-red-500/30 bg-red-500/10 text-red-400",
};

const KYC_STATUS_LABEL: Record<string, string> = {
  pending:   "En attente",
  submitted: "Documents soumis",
  approved:  "Approuvé",
  rejected:  "Rejeté",
};

const KYC_STATUS_ICON: Record<string, React.ElementType> = {
  pending:   Clock,
  submitted: FileText,
  approved:  CheckCircle2,
  rejected:  XCircle,
};

const DOC_TYPE_LABEL: Record<string, string> = {
  id_card:      "Carte d'identité",
  driver_license: "Permis de conduire",
  vehicle_registration: "Carte grise",
  proof_of_address: "Justificatif de domicile",
  selfie:       "Selfie",
};

export default function DriverKycPage() {
  const qc = useQueryClient();
  const [kycFilter, setKycFilter] = useState("all");
  const [selectedDriver, setSelectedDriver] = useState<DriverKyc | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [confirmAction, setConfirmAction] = useState<"approve" | "reject" | null>(null);

  const { data: drivers = [], isLoading, refetch } = useQuery<DriverKyc[]>({
    queryKey: ["driver-kyc", kycFilter],
    queryFn: () =>
      apiGet("/driver-docs/list", kycFilter !== "all" ? { kyc_status: kycFilter } : {}),
    staleTime: 30_000,
  });

  const { data: driverDetail, isLoading: detailLoading } = useQuery<DriverKyc>({
    queryKey: ["driver-kyc-detail", selectedDriver?.id],
    queryFn: () => apiGet(`/driver-docs/driver/${selectedDriver!.id}`),
    enabled: !!selectedDriver,
  });

  const reviewMutation = useMutation({
    mutationFn: ({ id, approved, reason }: { id: string; approved: boolean; reason?: string }) =>
      apiPost(`/driver-docs/driver/${id}/review`, { approved, reason }),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["driver-kyc"] });
      toast.success(vars.approved ? "Livreur approuvé" : "Livreur rejeté");
      setSelectedDriver(null);
      setConfirmAction(null);
      setRejectReason("");
    },
    onError: () => toast.error("Erreur lors de la révision KYC"),
  });

  const statCounts = {
    all: drivers.length,
    pending: drivers.filter((d) => d.kyc_status === "pending").length,
    submitted: drivers.filter((d) => d.kyc_status === "submitted").length,
    approved: drivers.filter((d) => d.kyc_status === "approved").length,
    rejected: drivers.filter((d) => d.kyc_status === "rejected").length,
  };

  function handleApprove() {
    if (!selectedDriver) return;
    reviewMutation.mutate({ id: selectedDriver.id, approved: true });
  }

  function handleReject() {
    if (!selectedDriver) return;
    if (!rejectReason.trim()) return;
    reviewMutation.mutate({ id: selectedDriver.id, approved: false, reason: rejectReason.trim() });
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <ShieldCheck className="h-6 w-6 text-brand-400" />
            KYC Livreurs
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Vérification d&apos;identité et validation des documents des livreurs.
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={() => refetch()} className="text-slate-400 gap-1.5">
          <RefreshCw className="h-3.5 w-3.5" />
          Actualiser
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          { key: "submitted", label: "À examiner", color: "text-blue-500", bg: "bg-blue-500/10" },
          { key: "approved",  label: "Approuvés",  color: "text-green-500", bg: "bg-green-500/10" },
          { key: "rejected",  label: "Rejetés",    color: "text-red-400",   bg: "bg-red-500/10" },
          { key: "pending",   label: "En attente", color: "text-slate-500", bg: "bg-slate-500/10" },
        ].map((s) => (
          <Card key={s.key} className="cursor-pointer hover:shadow-sm transition-shadow" onClick={() => setKycFilter(s.key)}>
            <CardContent className="p-4">
              <div className={cn("h-8 w-8 rounded-lg flex items-center justify-center mb-2", s.bg)}>
                {(() => {
                  const Icon = KYC_STATUS_ICON[s.key] ?? Clock;
                  return <Icon className={cn("h-4 w-4", s.color)} />;
                })()}
              </div>
              <p className="text-xs text-slate-400">{s.label}</p>
              <p className={cn("text-2xl font-bold mt-0.5", s.color)}>
                {statCounts[s.key as keyof typeof statCounts]}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filter */}
      <div className="flex items-center gap-3">
        <Select value={kycFilter} onValueChange={setKycFilter}>
          <SelectTrigger className="w-52">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les livreurs ({statCounts.all})</SelectItem>
            <SelectItem value="submitted">Documents soumis ({statCounts.submitted})</SelectItem>
            <SelectItem value="pending">En attente ({statCounts.pending})</SelectItem>
            <SelectItem value="approved">Approuvés ({statCounts.approved})</SelectItem>
            <SelectItem value="rejected">Rejetés ({statCounts.rejected})</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Livreur</TableHead>
                <TableHead>Téléphone</TableHead>
                <TableHead>Statut KYC</TableHead>
                <TableHead>Documents</TableHead>
                <TableHead>Soumis le</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading
                ? Array.from({ length: 6 }).map((_, i) => (
                    <TableRow key={i}>
                      {Array.from({ length: 6 }).map((_, j) => (
                        <TableCell key={j}><Skeleton className="h-5 w-full" /></TableCell>
                      ))}
                    </TableRow>
                  ))
                : drivers.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6}>
                        <div className="flex flex-col items-center justify-center py-12 gap-2 text-slate-400">
                          <ShieldCheck className="h-10 w-10 opacity-30" />
                          <p className="text-sm">Aucun livreur trouvé pour ce filtre</p>
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                : drivers.map((driver) => {
                    const Icon = KYC_STATUS_ICON[driver.kyc_status] ?? Clock;
                    return (
                      <TableRow
                        key={driver.id}
                        className="cursor-pointer hover:bg-slate-50"
                        onClick={() => setSelectedDriver(driver)}
                      >
                        <TableCell>
                          <div className="flex items-center gap-2.5">
                            <div className="h-8 w-8 rounded-full bg-brand-500/20 flex items-center justify-center text-brand-400 font-bold text-xs shrink-0">
                              {driver.name.slice(0, 2).toUpperCase()}
                            </div>
                            <p className="font-medium text-slate-900">{driver.name}</p>
                          </div>
                        </TableCell>
                        <TableCell className="text-slate-600">{driver.phone}</TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={cn("text-xs gap-1", KYC_STATUS_STYLE[driver.kyc_status])}
                          >
                            <Icon className="h-3 w-3" />
                            {KYC_STATUS_LABEL[driver.kyc_status]}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-slate-600">
                          {driver.documents?.length ?? 0} doc{(driver.documents?.length ?? 0) !== 1 ? "s" : ""}
                        </TableCell>
                        <TableCell className="text-xs text-slate-400">
                          {driver.submitted_at
                            ? new Date(driver.submitted_at).toLocaleDateString("fr-FR")
                            : "—"}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="sm" className="gap-1.5 text-slate-400 hover:text-brand-500">
                            <Eye className="h-3.5 w-3.5" /> Voir
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Driver KYC detail dialog */}
      <Dialog open={!!selectedDriver} onOpenChange={(o) => { if (!o) { setSelectedDriver(null); setConfirmAction(null); setRejectReason(""); } }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <User className="h-5 w-5 text-brand-400" />
              KYC — {selectedDriver?.name}
            </DialogTitle>
          </DialogHeader>

          {detailLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : (
            <div className="space-y-4">
              {/* Driver info */}
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-slate-400 text-xs mb-0.5">Nom</p>
                  <p className="font-medium text-slate-900">{driverDetail?.name ?? selectedDriver?.name}</p>
                </div>
                <div>
                  <p className="text-slate-400 text-xs mb-0.5">Téléphone</p>
                  <p className="text-slate-900">{driverDetail?.phone ?? selectedDriver?.phone}</p>
                </div>
                <div>
                  <p className="text-slate-400 text-xs mb-0.5">Statut KYC</p>
                  {(() => {
                    const status = driverDetail?.kyc_status ?? selectedDriver?.kyc_status ?? "pending";
                    const Icon = KYC_STATUS_ICON[status] ?? Clock;
                    return (
                      <Badge variant="outline" className={cn("text-xs gap-1", KYC_STATUS_STYLE[status])}>
                        <Icon className="h-3 w-3" />
                        {KYC_STATUS_LABEL[status]}
                      </Badge>
                    );
                  })()}
                </div>
                <div>
                  <p className="text-slate-400 text-xs mb-0.5">Soumis le</p>
                  <p className="text-slate-900">
                    {driverDetail?.submitted_at
                      ? new Date(driverDetail.submitted_at).toLocaleDateString("fr-FR")
                      : "—"}
                  </p>
                </div>
              </div>

              {/* Documents list */}
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                  Documents ({driverDetail?.documents?.length ?? 0})
                </p>
                {!driverDetail?.documents || driverDetail.documents.length === 0 ? (
                  <div className="flex items-center gap-2 rounded-lg bg-slate-50 border border-slate-200 px-3 py-3 text-sm text-slate-400">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    Aucun document soumis
                  </div>
                ) : (
                  <div className="space-y-2">
                    {driverDetail.documents.map((doc) => (
                      <div
                        key={doc.id}
                        className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5"
                      >
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4 text-slate-400 shrink-0" />
                          <div>
                            <p className="text-sm font-medium text-slate-900">
                              {DOC_TYPE_LABEL[doc.type] ?? doc.type}
                            </p>
                            <p className="text-xs text-slate-400">
                              {new Date(doc.created_at).toLocaleDateString("fr-FR")}
                            </p>
                          </div>
                        </div>
                        <a
                          href={doc.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 text-xs text-brand-500 hover:underline"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                          Voir
                        </a>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Approve / Reject — only for submitted */}
              {(driverDetail?.kyc_status ?? selectedDriver?.kyc_status) === "submitted" && (
                <div className="border-t border-slate-100 pt-3 space-y-3">
                  {confirmAction === "reject" ? (
                    <div className="space-y-2">
                      <Label>Motif du rejet <span className="text-red-500">*</span></Label>
                      <Textarea
                        placeholder="Ex : Document illisible, photo floue, carte expirée…"
                        rows={3}
                        value={rejectReason}
                        onChange={(e) => setRejectReason(e.target.value)}
                      />
                      {!rejectReason.trim() && (
                        <p className="text-xs text-red-400 flex items-center gap-1">
                          <AlertCircle className="h-3 w-3" /> Un motif est requis
                        </p>
                      )}
                      <div className="flex gap-2">
                        <Button variant="outline" className="flex-1" onClick={() => setConfirmAction(null)}>
                          Annuler
                        </Button>
                        <Button
                          variant="destructive"
                          className="flex-1"
                          disabled={!rejectReason.trim() || reviewMutation.isPending}
                          onClick={handleReject}
                        >
                          {reviewMutation.isPending ? "Rejet en cours…" : "Confirmer le rejet"}
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex gap-3">
                      <Button
                        className="flex-1 bg-green-500 hover:bg-green-600 gap-2"
                        disabled={reviewMutation.isPending}
                        onClick={handleApprove}
                      >
                        <CheckCircle2 className="h-4 w-4" />
                        Approuver
                      </Button>
                      <Button
                        variant="destructive"
                        className="flex-1 gap-2"
                        disabled={reviewMutation.isPending}
                        onClick={() => setConfirmAction("reject")}
                      >
                        <XCircle className="h-4 w-4" />
                        Rejeter
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => { setSelectedDriver(null); setConfirmAction(null); setRejectReason(""); }}>
              Fermer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
