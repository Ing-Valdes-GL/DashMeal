"use client";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/stores/auth";
import { apiGet, apiPost, apiPatch, apiDelete } from "@/lib/api";
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
import { Switch } from "@/components/ui/switch";
import {
  MapPin, Plus, Pencil, Trash2, Store, RefreshCw,
  ToggleLeft, ToggleRight, AlertCircle, Info,
} from "lucide-react";

interface Branch {
  id: string;
  name: string;
}

interface DeliveryZone {
  id: string;
  name: string;
  delivery_fee: number;
  min_order: number | null;
  estimated_min: number | null;
  is_active: boolean;
  color: string | null;
  polygon: { lat: number; lng: number }[] | null;
  branch_id: string;
}

interface ZoneForm {
  name: string;
  delivery_fee: number;
  min_order: number;
  estimated_min: number;
  polygon_raw: string;
  color: string;
  is_active: boolean;
}

const PRESET_COLORS = [
  "#f97316", // orange brand
  "#3b82f6", // blue
  "#22c55e", // green
  "#a855f7", // purple
  "#ec4899", // pink
];

const EMPTY_FORM: ZoneForm = {
  name: "",
  delivery_fee: 0,
  min_order: 0,
  estimated_min: 30,
  polygon_raw: "",
  color: PRESET_COLORS[0],
  is_active: true,
};

function parsePolygon(raw: string): { lat: number; lng: number }[] | null {
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    if (parsed.some((p) => typeof p.lat !== "number" || typeof p.lng !== "number")) return null;
    return parsed;
  } catch {
    return null;
  }
}

export default function DeliveryZonesPage() {
  const { user } = useAuthStore();
  const qc = useQueryClient();
  const [selectedBranchId, setSelectedBranchId] = useState<string>("");
  const [showDialog, setShowDialog] = useState(false);
  const [editTarget, setEditTarget] = useState<DeliveryZone | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DeliveryZone | null>(null);
  const [form, setForm] = useState<ZoneForm>(EMPTY_FORM);
  const [formError, setFormError] = useState<string | null>(null);
  const [polygonError, setPolygonError] = useState<string | null>(null);

  const { data: branches = [], isLoading: branchesLoading } = useQuery<Branch[]>({
    queryKey: ["branches", user?.brand_id],
    queryFn: () => apiGet("/branches", user?.brand_id ? { brand_id: user.brand_id } : {}),
    staleTime: 60_000,
  });

  // Auto-select first branch when loaded
  if (branches.length > 0 && !selectedBranchId) {
    setSelectedBranchId(branches[0].id);
  }

  const { data: zones = [], isLoading: zonesLoading, refetch } = useQuery<DeliveryZone[]>({
    queryKey: ["delivery-zones", selectedBranchId],
    queryFn: () => apiGet("/delivery-zones", { branch_id: selectedBranchId }),
    enabled: !!selectedBranchId,
    staleTime: 30_000,
  });

  const createMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => apiPost("/delivery-zones", data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["delivery-zones", selectedBranchId] });
      toast.success("Zone créée avec succès");
      closeDialog();
    },
    onError: (e: any) => toast.error(e?.response?.data?.error?.message ?? "Erreur de création"),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) =>
      apiPatch(`/delivery-zones/${id}`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["delivery-zones", selectedBranchId] });
      toast.success("Zone mise à jour");
      closeDialog();
    },
    onError: (e: any) => toast.error(e?.response?.data?.error?.message ?? "Erreur"),
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, is_active }: { id: string; is_active: boolean }) =>
      apiPatch(`/delivery-zones/${id}`, { is_active }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["delivery-zones", selectedBranchId] }),
    onError: () => toast.error("Erreur"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiDelete(`/delivery-zones/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["delivery-zones", selectedBranchId] });
      toast.success("Zone supprimée");
      setDeleteTarget(null);
    },
    onError: () => toast.error("Erreur lors de la suppression"),
  });

  function openCreate() {
    setEditTarget(null);
    setForm(EMPTY_FORM);
    setFormError(null);
    setPolygonError(null);
    setShowDialog(true);
  }

  function openEdit(z: DeliveryZone) {
    setEditTarget(z);
    setForm({
      name: z.name,
      delivery_fee: z.delivery_fee,
      min_order: z.min_order ?? 0,
      estimated_min: z.estimated_min ?? 30,
      polygon_raw: z.polygon ? JSON.stringify(z.polygon, null, 2) : "",
      color: z.color ?? PRESET_COLORS[0],
      is_active: z.is_active,
    });
    setFormError(null);
    setPolygonError(null);
    setShowDialog(true);
  }

  function closeDialog() {
    setShowDialog(false);
    setEditTarget(null);
    setForm(EMPTY_FORM);
    setFormError(null);
    setPolygonError(null);
  }

  function handleSubmit() {
    if (!form.name.trim()) { setFormError("Le nom est requis"); return; }
    if (!form.delivery_fee || form.delivery_fee < 0) { setFormError("Les frais de livraison doivent être valides"); return; }
    if (!selectedBranchId) { setFormError("Veuillez sélectionner une agence"); return; }

    let polygon: { lat: number; lng: number }[] | null = null;
    if (form.polygon_raw.trim()) {
      polygon = parsePolygon(form.polygon_raw);
      if (!polygon) {
        setPolygonError("JSON invalide. Format attendu : [{\"lat\": 3.87, \"lng\": 11.52}, ...]");
        return;
      }
    }
    setFormError(null);
    setPolygonError(null);

    const payload: Record<string, unknown> = {
      name: form.name.trim(),
      delivery_fee: Number(form.delivery_fee),
      min_order: form.min_order ? Number(form.min_order) : null,
      estimated_min: form.estimated_min ? Number(form.estimated_min) : null,
      color: form.color,
      is_active: form.is_active,
      branch_id: selectedBranchId,
      polygon,
    };

    if (editTarget) {
      updateMutation.mutate({ id: editTarget.id, data: payload });
    } else {
      createMutation.mutate(payload);
    }
  }

  const isSubmitting = createMutation.isPending || updateMutation.isPending;
  const activeZones = zones.filter((z) => z.is_active).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <MapPin className="h-6 w-6 text-brand-400" />
            Zones de livraison
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Définissez les zones de livraison et leurs tarifs par agence.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={() => refetch()} className="text-slate-400">
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
          <Button size="sm" onClick={openCreate} disabled={!selectedBranchId} className="gap-1.5">
            <Plus className="h-4 w-4" />
            Nouvelle zone
          </Button>
        </div>
      </div>

      {/* Branch selector */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="space-y-1.5 min-w-[240px]">
              <Label>Agence à configurer</Label>
              {branchesLoading ? (
                <Skeleton className="h-10 w-full" />
              ) : (
                <Select value={selectedBranchId} onValueChange={setSelectedBranchId}>
                  <SelectTrigger>
                    <Store className="h-3.5 w-3.5 mr-2 text-slate-400" />
                    <SelectValue placeholder="Sélectionner une agence…" />
                  </SelectTrigger>
                  <SelectContent>
                    {branches.map((b) => (
                      <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
            {selectedBranchId && !zonesLoading && (
              <div className="flex gap-4 text-sm">
                <span className="text-slate-400">{zones.length} zone{zones.length !== 1 ? "s" : ""}</span>
                <span className="text-green-500">{activeZones} active{activeZones !== 1 ? "s" : ""}</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Zones list */}
      {!selectedBranchId ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3 text-slate-400">
          <Store className="h-12 w-12 opacity-30" />
          <p className="text-sm">Sélectionnez une agence pour gérer ses zones de livraison.</p>
        </div>
      ) : zonesLoading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-40 w-full rounded-xl" />
          ))}
        </div>
      ) : zones.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3 text-slate-400">
          <MapPin className="h-12 w-12 opacity-30" />
          <p className="text-sm">Aucune zone de livraison pour cette agence.</p>
          <Button size="sm" variant="outline" onClick={openCreate} className="gap-1.5">
            <Plus className="h-3.5 w-3.5" /> Créer la première zone
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {zones.map((zone) => (
            <Card
              key={zone.id}
              className={cn(
                "overflow-hidden transition-shadow hover:shadow-md",
                !zone.is_active && "opacity-60"
              )}
            >
              {/* Color stripe */}
              <div className="h-1.5 w-full" style={{ backgroundColor: zone.color ?? "#f97316" }} />
              <CardContent className="p-4 space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-semibold text-slate-900">{zone.name}</p>
                    {zone.polygon && (
                      <p className="text-xs text-slate-400 mt-0.5">
                        {zone.polygon.length} point{zone.polygon.length !== 1 ? "s" : ""} de polygone
                      </p>
                    )}
                  </div>
                  <Badge
                    variant="outline"
                    className={cn(
                      "text-xs shrink-0",
                      zone.is_active
                        ? "border-green-500/30 bg-green-500/10 text-green-400"
                        : "border-slate-500/30 bg-slate-500/10 text-slate-400"
                    )}
                  >
                    {zone.is_active ? "Active" : "Inactive"}
                  </Badge>
                </div>

                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="rounded-lg bg-slate-50 p-2.5">
                    <p className="text-xs text-slate-400">Frais livraison</p>
                    <p className="font-bold text-brand-500">{formatCurrency(zone.delivery_fee)}</p>
                  </div>
                  <div className="rounded-lg bg-slate-50 p-2.5">
                    <p className="text-xs text-slate-400">Durée estimée</p>
                    <p className="font-semibold text-slate-900">
                      {zone.estimated_min ? `${zone.estimated_min} min` : "—"}
                    </p>
                  </div>
                  {zone.min_order && zone.min_order > 0 && (
                    <div className="rounded-lg bg-slate-50 p-2.5 col-span-2">
                      <p className="text-xs text-slate-400">Commande min.</p>
                      <p className="font-semibold text-slate-900">{formatCurrency(zone.min_order)}</p>
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between pt-1 border-t border-slate-100">
                  <button
                    onClick={() => toggleMutation.mutate({ id: zone.id, is_active: !zone.is_active })}
                    className="text-slate-400 hover:text-slate-700 transition-colors"
                    title={zone.is_active ? "Désactiver" : "Activer"}
                  >
                    {zone.is_active ? (
                      <ToggleRight className="h-5 w-5 text-green-500" />
                    ) : (
                      <ToggleLeft className="h-5 w-5" />
                    )}
                  </button>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-slate-400 hover:text-brand-500"
                      onClick={() => openEdit(zone)}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-slate-400 hover:text-red-500"
                      onClick={() => setDeleteTarget(zone)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create / Edit Dialog */}
      <Dialog open={showDialog} onOpenChange={(o) => { if (!o) closeDialog(); }}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5 text-brand-400" />
              {editTarget ? "Modifier la zone" : "Nouvelle zone de livraison"}
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
              <Label>Nom de la zone <span className="text-red-500">*</span></Label>
              <Input
                placeholder="Ex : Centre-ville, Zone Nord, Aéroport…"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Frais de livraison (FCFA) <span className="text-red-500">*</span></Label>
                <Input
                  type="number"
                  min={0}
                  placeholder="1000"
                  value={form.delivery_fee || ""}
                  onChange={(e) => setForm((f) => ({ ...f, delivery_fee: Number(e.target.value) }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Durée estimée (min)</Label>
                <Input
                  type="number"
                  min={5}
                  placeholder="30"
                  value={form.estimated_min || ""}
                  onChange={(e) => setForm((f) => ({ ...f, estimated_min: Number(e.target.value) }))}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Commande minimale (FCFA)</Label>
              <Input
                type="number"
                min={0}
                placeholder="Aucun minimum"
                value={form.min_order || ""}
                onChange={(e) => setForm((f) => ({ ...f, min_order: Number(e.target.value) }))}
              />
            </div>

            {/* Color picker */}
            <div className="space-y-2">
              <Label>Couleur de la zone</Label>
              <div className="flex gap-2">
                {PRESET_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    className={cn(
                      "h-8 w-8 rounded-full border-2 transition-transform hover:scale-110",
                      form.color === c ? "border-slate-900 scale-110" : "border-transparent"
                    )}
                    style={{ backgroundColor: c }}
                    onClick={() => setForm((f) => ({ ...f, color: c }))}
                  />
                ))}
                <input
                  type="color"
                  value={form.color}
                  onChange={(e) => setForm((f) => ({ ...f, color: e.target.value }))}
                  className="h-8 w-8 rounded-full border border-slate-200 cursor-pointer"
                  title="Couleur personnalisée"
                />
              </div>
            </div>

            {/* Polygon input */}
            <div className="space-y-1.5">
              <Label>Polygone JSON (optionnel)</Label>
              <Textarea
                placeholder={'[\n  {"lat": 3.8731, "lng": 11.5144},\n  {"lat": 3.8890, "lng": 11.5300},\n  ...\n]'}
                rows={5}
                value={form.polygon_raw}
                onChange={(e) => { setForm((f) => ({ ...f, polygon_raw: e.target.value })); setPolygonError(null); }}
                className="font-mono text-xs"
              />
              {polygonError ? (
                <p className="text-xs text-red-400 flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />
                  {polygonError}
                </p>
              ) : (
                <p className="text-xs text-slate-400 flex items-start gap-1">
                  <Info className="h-3 w-3 mt-0.5 shrink-0" />
                  Tableau de coordonnées <code className="bg-slate-100 px-1 rounded">lat/lng</code>.
                  Laissez vide si non configuré.
                </p>
              )}
            </div>

            {/* Active toggle */}
            <div className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2.5">
              <div>
                <p className="text-sm font-medium text-slate-900">Zone active</p>
                <p className="text-xs text-slate-400">Les clients pourront sélectionner cette zone</p>
              </div>
              <Switch
                checked={form.is_active}
                onCheckedChange={(v) => setForm((f) => ({ ...f, is_active: v }))}
              />
            </div>
          </div>
          <DialogFooter className="gap-2 pt-2">
            <Button variant="outline" onClick={closeDialog}>Annuler</Button>
            <Button onClick={handleSubmit} disabled={isSubmitting}>
              {isSubmitting ? "Enregistrement…" : editTarget ? "Enregistrer" : "Créer la zone"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={(o) => { if (!o) setDeleteTarget(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-red-500 flex items-center gap-2">
              <Trash2 className="h-5 w-5" /> Supprimer la zone
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-slate-600">
            Êtes-vous sûr de vouloir supprimer la zone{" "}
            <span className="font-semibold text-slate-900">{deleteTarget?.name}</span> ?
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
