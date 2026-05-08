"use client";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPost, apiPatch, apiDelete } from "@/lib/api";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import { cn } from "@/lib/utils";
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Pencil, Trash2, ToggleLeft, ToggleRight, Tag, Percent, Hash, RefreshCw, AlertCircle } from "lucide-react";

interface Promotion {
  id: string;
  code: string;
  type: "percent" | "fixed";
  value: number;
  min_order: number | null;
  max_uses: number | null;
  uses_count: number;
  expires_at: string | null;
  is_active: boolean;
  description: string | null;
  created_at: string;
}

interface PromoForm {
  code: string;
  type: "percent" | "fixed";
  value: number;
  min_order: number | null;
  max_uses: number | null;
  expires_at: string;
  description: string;
}

const EMPTY_FORM: PromoForm = {
  code: "",
  type: "percent",
  value: 0,
  min_order: null,
  max_uses: null,
  expires_at: "",
  description: "",
};

function isExpired(expires_at: string | null): boolean {
  if (!expires_at) return false;
  return new Date(expires_at) < new Date();
}

export default function PromotionsPage() {
  const qc = useQueryClient();
  const [showDialog, setShowDialog] = useState(false);
  const [editTarget, setEditTarget] = useState<Promotion | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Promotion | null>(null);
  const [form, setForm] = useState<PromoForm>(EMPTY_FORM);
  const [formError, setFormError] = useState<string | null>(null);

  const { data: promotions = [], isLoading, refetch } = useQuery<Promotion[]>({
    queryKey: ["promotions"],
    queryFn: () => apiGet("/promotions"),
    staleTime: 30_000,
  });

  const createMutation = useMutation({
    mutationFn: (data: Partial<PromoForm>) => apiPost("/promotions", data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["promotions"] });
      toast.success("Promotion créée avec succès");
      closeDialog();
    },
    onError: (e: any) => toast.error(e?.response?.data?.error?.message ?? "Erreur de création"),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<PromoForm> }) =>
      apiPatch(`/promotions/${id}`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["promotions"] });
      toast.success("Promotion mise à jour");
      closeDialog();
    },
    onError: (e: any) => toast.error(e?.response?.data?.error?.message ?? "Erreur"),
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, is_active }: { id: string; is_active: boolean }) =>
      apiPatch(`/promotions/${id}`, { is_active }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["promotions"] });
    },
    onError: () => toast.error("Erreur"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiDelete(`/promotions/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["promotions"] });
      toast.success("Promotion supprimée");
      setDeleteTarget(null);
    },
    onError: () => toast.error("Erreur lors de la suppression"),
  });

  function openCreate() {
    setEditTarget(null);
    setForm(EMPTY_FORM);
    setFormError(null);
    setShowDialog(true);
  }

  function openEdit(p: Promotion) {
    setEditTarget(p);
    setForm({
      code: p.code,
      type: p.type,
      value: p.value,
      min_order: p.min_order,
      max_uses: p.max_uses,
      expires_at: p.expires_at ? p.expires_at.slice(0, 10) : "",
      description: p.description ?? "",
    });
    setFormError(null);
    setShowDialog(true);
  }

  function closeDialog() {
    setShowDialog(false);
    setEditTarget(null);
    setForm(EMPTY_FORM);
    setFormError(null);
  }

  function handleSubmit() {
    if (!form.code.trim()) { setFormError("Le code est requis"); return; }
    if (!form.value || form.value <= 0) { setFormError("La valeur doit être supérieure à 0"); return; }
    if (form.type === "percent" && form.value > 100) { setFormError("Le pourcentage ne peut pas dépasser 100%"); return; }

    const payload: Record<string, unknown> = {
      code: form.code.trim().toUpperCase(),
      type: form.type,
      value: Number(form.value),
      description: form.description || null,
      min_order: form.min_order ? Number(form.min_order) : null,
      max_uses: form.max_uses ? Number(form.max_uses) : null,
      expires_at: form.expires_at || null,
    };

    if (editTarget) {
      updateMutation.mutate({ id: editTarget.id, data: payload });
    } else {
      createMutation.mutate(payload);
    }
  }

  const isSubmitting = createMutation.isPending || updateMutation.isPending;
  const activeCount = promotions.filter((p) => p.is_active && !isExpired(p.expires_at)).length;
  const expiredCount = promotions.filter((p) => isExpired(p.expires_at)).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Tag className="h-6 w-6 text-brand-400" />
            Promotions & Coupons
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Gérez vos codes promotionnels et remises clients.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={() => refetch()} className="text-slate-400">
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
          <Button size="sm" onClick={openCreate} className="gap-1.5">
            <Plus className="h-4 w-4" />
            Nouvelle promotion
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Total", value: promotions.length, color: "text-slate-900" },
          { label: "Actives", value: activeCount, color: "text-green-500" },
          { label: "Expirées", value: expiredCount, color: "text-red-400" },
        ].map((s) => (
          <Card key={s.label}>
            <CardContent className="p-4">
              <p className="text-sm text-slate-400">{s.label}</p>
              <p className={`text-2xl font-bold mt-1 ${s.color}`}>{s.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : promotions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-slate-500">
              <Tag className="h-12 w-12 opacity-30" />
              <p className="text-sm">Aucune promotion créée</p>
              <Button size="sm" variant="outline" onClick={openCreate} className="gap-1.5">
                <Plus className="h-3.5 w-3.5" /> Créer la première
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Valeur</TableHead>
                  <TableHead>Commande min.</TableHead>
                  <TableHead>Utilisations</TableHead>
                  <TableHead>Expiration</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {promotions.map((p) => {
                  const expired = isExpired(p.expires_at);
                  return (
                    <TableRow key={p.id}>
                      <TableCell>
                        <span className="font-mono font-semibold text-slate-900 tracking-wider">
                          {p.code}
                        </span>
                        {p.description && (
                          <p className="text-xs text-slate-400 mt-0.5 max-w-[180px] truncate">{p.description}</p>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={cn(
                            "text-xs",
                            p.type === "percent"
                              ? "border-purple-500/30 bg-purple-500/10 text-purple-400"
                              : "border-blue-500/30 bg-blue-500/10 text-blue-400"
                          )}
                        >
                          {p.type === "percent" ? (
                            <><Percent className="h-3 w-3 mr-1" />Pourcentage</>
                          ) : (
                            <><Hash className="h-3 w-3 mr-1" />Montant fixe</>
                          )}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-semibold text-slate-900">
                        {p.type === "percent" ? `${p.value}%` : formatCurrency(p.value)}
                      </TableCell>
                      <TableCell className="text-slate-600">
                        {p.min_order ? formatCurrency(p.min_order) : <span className="text-slate-400">—</span>}
                      </TableCell>
                      <TableCell className="text-slate-600">
                        {p.uses_count}
                        {p.max_uses && (
                          <span className="text-slate-400"> / {p.max_uses}</span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm">
                        {p.expires_at ? (
                          <span className={expired ? "text-red-400" : "text-slate-600"}>
                            {new Date(p.expires_at).toLocaleDateString("fr-FR")}
                          </span>
                        ) : (
                          <span className="text-slate-400">Sans limite</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {expired ? (
                          <Badge variant="outline" className="border-red-500/30 bg-red-500/10 text-red-400 text-xs">
                            Expirée
                          </Badge>
                        ) : p.is_active ? (
                          <Badge variant="outline" className="border-green-500/30 bg-green-500/10 text-green-400 text-xs">
                            Active
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="border-slate-500/30 bg-slate-500/10 text-slate-400 text-xs">
                            Inactive
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-slate-400"
                            title={p.is_active ? "Désactiver" : "Activer"}
                            onClick={() => toggleMutation.mutate({ id: p.id, is_active: !p.is_active })}
                          >
                            {p.is_active ? (
                              <ToggleRight className="h-4 w-4 text-green-500" />
                            ) : (
                              <ToggleLeft className="h-4 w-4" />
                            )}
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-slate-400 hover:text-brand-500"
                            onClick={() => openEdit(p)}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-slate-400 hover:text-red-500"
                            onClick={() => setDeleteTarget(p)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Create / Edit Dialog */}
      <Dialog open={showDialog} onOpenChange={(o) => { if (!o) closeDialog(); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Tag className="h-5 w-5 text-brand-400" />
              {editTarget ? "Modifier la promotion" : "Nouvelle promotion"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {formError && (
              <div className="flex items-center gap-2 rounded-lg bg-red-500/10 border border-red-500/20 px-3 py-2 text-sm text-red-400">
                <AlertCircle className="h-4 w-4 shrink-0" />
                {formError}
              </div>
            )}
            <div className="space-y-1.5">
              <Label>Code promotionnel <span className="text-red-500">*</span></Label>
              <Input
                placeholder="SUMMER20"
                value={form.code}
                onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))}
                className="font-mono tracking-wider"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Type de réduction <span className="text-red-500">*</span></Label>
              <Select value={form.type} onValueChange={(v) => setForm((f) => ({ ...f, type: v as "percent" | "fixed" }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="percent">Pourcentage (%)</SelectItem>
                  <SelectItem value="fixed">Montant fixe (FCFA)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Valeur <span className="text-red-500">*</span></Label>
                <Input
                  type="number"
                  min={1}
                  max={form.type === "percent" ? 100 : undefined}
                  placeholder={form.type === "percent" ? "20" : "5000"}
                  value={form.value || ""}
                  onChange={(e) => setForm((f) => ({ ...f, value: Number(e.target.value) }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Commande min. (FCFA)</Label>
                <Input
                  type="number"
                  min={0}
                  placeholder="Aucun minimum"
                  value={form.min_order ?? ""}
                  onChange={(e) => setForm((f) => ({ ...f, min_order: e.target.value ? Number(e.target.value) : null }))}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Utilisations max.</Label>
                <Input
                  type="number"
                  min={1}
                  placeholder="Illimité"
                  value={form.max_uses ?? ""}
                  onChange={(e) => setForm((f) => ({ ...f, max_uses: e.target.value ? Number(e.target.value) : null }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Date d&apos;expiration</Label>
                <Input
                  type="date"
                  value={form.expires_at}
                  onChange={(e) => setForm((f) => ({ ...f, expires_at: e.target.value }))}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Description (optionnel)</Label>
              <Textarea
                placeholder="Promotion été 2025 pour les clients fidèles…"
                rows={2}
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter className="gap-2 pt-2">
            <Button variant="outline" onClick={closeDialog}>Annuler</Button>
            <Button onClick={handleSubmit} disabled={isSubmitting}>
              {isSubmitting ? "Enregistrement…" : editTarget ? "Enregistrer" : "Créer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm Dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={(o) => { if (!o) setDeleteTarget(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-red-500 flex items-center gap-2">
              <Trash2 className="h-5 w-5" /> Supprimer la promotion
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-slate-600">
            Êtes-vous sûr de vouloir supprimer le code{" "}
            <span className="font-mono font-semibold text-slate-900">{deleteTarget?.code}</span> ?
            Cette action est irréversible.
          </p>
          <DialogFooter className="gap-2 pt-2">
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Annuler</Button>
            <Button
              variant="destructive"
              disabled={deleteMutation.isPending}
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
            >
              {deleteMutation.isPending ? "Suppression…" : "Supprimer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
