"use client";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { apiGet, apiPost } from "@/lib/api";
import { formatDateTime } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Pagination } from "@/components/ui/pagination";
import {
  FileText, CheckCircle, XCircle, Eye, RefreshCw,
  Download, Image as ImageIcon, File,
} from "lucide-react";

interface Application {
  id: string; brand_name: string; contact_email: string; contact_phone: string;
  status: "pending" | "approved" | "rejected" | "suspended";
  submitted_at: string; reviewed_at: string | null; rejection_reason: string | null;
  brand_documents?: { id: string; type: string; url: string; verified: boolean }[];
}

const STATUS_VARIANT: Record<string, any> = {
  pending: "pending",
  approved: "active",
  rejected: "cancelled",
  suspended: "inactive",
};

const DOC_TYPES: Record<string, string> = {
  niu: "NIU (Impôts)",
  logo: "Logo",
  online_presence: "Présence en ligne",
  rccm: "RCCM",
  other: "Autre",
};

export default function ApplicationsPage() {
  const t = useTranslations("applications");
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState("pending");
  const [selected, setSelected] = useState<Application | null>(null);
  const [showDetail, setShowDetail] = useState(false);
  const [showReject, setShowReject] = useState(false);
  const [rejectReason, setRejectReason] = useState("");

  const { data, isLoading, refetch } = useQuery<Application[]>({
    queryKey: ["applications", { page, statusFilter }],
    queryFn: () => apiGet<Application[]>("/brands/applications", {
      page, limit: 20,
      ...(statusFilter !== "all" && { status: statusFilter }),
    }),
  });

  const approveMutation = useMutation({
    mutationFn: (id: string) =>
      apiPost(`/brands/applications/${id}/review`, { status: "approved" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["applications"] });
      toast.success("Demande approuvée — compte admin créé");
      setShowDetail(false);
    },
    onError: () => toast.error("Erreur lors de l'approbation"),
  });

  const rejectMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      apiPost(`/brands/applications/${id}/review`, { status: "rejected", rejection_reason: reason }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["applications"] });
      toast.success("Demande rejetée");
      setShowDetail(false);
      setShowReject(false);
      setRejectReason("");
    },
    onError: () => toast.error("Erreur lors du rejet"),
  });

  const applications = data ?? [];

  const pendingCount = applications.filter((a) => a.status === "pending").length;

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">{t("title")}</h1>
          <p className="text-sm text-slate-400">{t("subtitle")}</p>
        </div>
        <div className="flex items-center gap-2">
          {pendingCount > 0 && (
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-500 text-xs font-bold text-white">
              {pendingCount}
            </span>
          )}
          <Button variant="ghost" size="sm" onClick={() => refetch()}><RefreshCw className="h-4 w-4" /></Button>
        </div>
      </div>

      {/* Filter */}
      <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1); }}>
        <SelectTrigger className="w-40">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Toutes</SelectItem>
          <SelectItem value="pending">{t("pending")}</SelectItem>
          <SelectItem value="approved">{t("approved")}</SelectItem>
          <SelectItem value="rejected">{t("rejected")}</SelectItem>
        </SelectContent>
      </Select>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("brandName")}</TableHead>
              <TableHead>{t("contactEmail")}</TableHead>
              <TableHead>{t("contactPhone")}</TableHead>
              <TableHead>{t("status")}</TableHead>
              <TableHead>{t("submittedAt")}</TableHead>
              <TableHead>Docs</TableHead>
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
              : applications.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell className="font-medium text-white">{a.brand_name}</TableCell>
                    <TableCell className="text-slate-300">{a.contact_email}</TableCell>
                    <TableCell className="text-slate-300">{a.contact_phone}</TableCell>
                    <TableCell>
                      <Badge variant={STATUS_VARIANT[a.status]}>{t(a.status as any)}</Badge>
                    </TableCell>
                    <TableCell className="text-xs text-slate-500">{formatDateTime(a.submitted_at)}</TableCell>
                    <TableCell className="text-xs text-slate-400">
                      {a.brand_documents?.length ?? 0} fichiers
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => { setSelected(a); setShowDetail(true); }}
                      >
                        <Eye className="h-4 w-4 mr-1" /> Examiner
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
          </TableBody>
        </Table>
        {(data?.length ?? 0) > 0 && (
          <div className="p-4 border-t border-surface-700/50 text-xs text-slate-500 text-right">
            {data?.length} résultat{(data?.length ?? 0) > 1 ? "s" : ""}
          </div>
        )}
      </Card>

      {/* Detail modal */}
      <Dialog open={showDetail} onOpenChange={setShowDetail}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Dossier — {selected?.brand_name}</DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-5">
              {/* Info */}
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><p className="text-slate-500">Statut</p>
                  <Badge variant={STATUS_VARIANT[selected.status]}>{t(selected.status as any)}</Badge>
                </div>
                <div><p className="text-slate-500">Soumis le</p>
                  <p className="text-white">{formatDateTime(selected.submitted_at)}</p>
                </div>
                <div><p className="text-slate-500">Contact email</p>
                  <p className="text-white">{selected.contact_email}</p>
                </div>
                <div><p className="text-slate-500">Contact tél.</p>
                  <p className="text-white">{selected.contact_phone}</p>
                </div>
              </div>

              {/* Documents */}
              {selected.brand_documents && selected.brand_documents.length > 0 && (
                <div>
                  <p className="text-sm font-medium text-white mb-2">{t("viewDocuments")}</p>
                  <div className="grid grid-cols-2 gap-2">
                    {selected.brand_documents.map((doc) => (
                      <a
                        key={doc.id}
                        href={doc.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 rounded-lg border border-surface-600 bg-surface-700/50 p-3 hover:border-brand-500 hover:bg-brand-500/10 transition-colors"
                      >
                        {doc.type === "logo" ? (
                          <ImageIcon className="h-4 w-4 text-brand-400 shrink-0" />
                        ) : (
                          <File className="h-4 w-4 text-brand-400 shrink-0" />
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-white truncate">{DOC_TYPES[doc.type] ?? doc.type}</p>
                          <p className="text-xs text-slate-500">{doc.verified ? "Vérifié" : "Non vérifié"}</p>
                        </div>
                        <Download className="h-3.5 w-3.5 text-slate-500 shrink-0" />
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {/* Rejection reason if rejected */}
              {selected.rejection_reason && (
                <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3">
                  <p className="text-xs text-red-400 mb-1">Motif de rejet</p>
                  <p className="text-sm text-slate-300">{selected.rejection_reason}</p>
                </div>
              )}
            </div>
          )}

          {selected?.status === "pending" && (
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setShowDetail(false)}>Fermer</Button>
              <Button
                variant="destructive"
                onClick={() => setShowReject(true)}
              >
                <XCircle className="h-4 w-4 mr-2" /> {t("reject")}
              </Button>
              <Button
                onClick={() => {
                  if (confirm(t("approveConfirm"))) approveMutation.mutate(selected.id);
                }}
                disabled={approveMutation.isPending}
              >
                <CheckCircle className="h-4 w-4 mr-2" /> {t("approve")}
              </Button>
            </DialogFooter>
          )}
          {selected?.status !== "pending" && (
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowDetail(false)}>Fermer</Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>

      {/* Reject dialog */}
      <Dialog open={showReject} onOpenChange={setShowReject}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("rejectConfirm")}</DialogTitle>
            <DialogDescription>
              Indiquez la raison du rejet pour informer la marque.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label>{t("rejectionReason")}</Label>
            <Textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Documents manquants, informations incorrectes..."
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowReject(false)}>Annuler</Button>
            <Button
              variant="destructive"
              onClick={() => rejectMutation.mutate({ id: selected!.id, reason: rejectReason })}
              disabled={!rejectReason.trim() || rejectMutation.isPending}
            >
              {rejectMutation.isPending ? "..." : "Confirmer le rejet"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
