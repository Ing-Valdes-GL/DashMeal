"use client";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useForm } from "react-hook-form";
import { useRouter, useParams } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { apiGet, apiPost, apiPatch, apiDelete } from "@/lib/api";
import { toast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, MoreHorizontal, Pencil, Trash2, MapPin, Phone, Clock, Store, Package } from "lucide-react";

// ─── Constantes ───────────────────────────────────────────────────────────────

const BRANCH_TYPE_OPTIONS = [
  { value: "supermarket", label: "🏪 Supermarché" },
  { value: "superette",   label: "🏬 Supérette" },
  { value: "restaurant",  label: "🍽️ Restaurant" },
  { value: "cafe",        label: "☕ Café" },
  { value: "bakery",      label: "🥖 Boulangerie" },
  { value: "pharmacy",    label: "💊 Pharmacie" },
  { value: "other",       label: "📦 Autre" },
] as const;

const WEEK_DAYS = [
  { key: "monday",    label: "Lundi" },
  { key: "tuesday",   label: "Mardi" },
  { key: "wednesday", label: "Mercredi" },
  { key: "thursday",  label: "Jeudi" },
  { key: "friday",    label: "Vendredi" },
  { key: "saturday",  label: "Samedi" },
  { key: "sunday",    label: "Dimanche" },
] as const;

type DayKey = typeof WEEK_DAYS[number]["key"];
type DaySchedule = { open: string; close: string; enabled: boolean };
type WeekSchedule = Record<DayKey, DaySchedule>;

const DEFAULT_WEEK_SCHEDULE: WeekSchedule = {
  monday:    { open: "08:00", close: "22:00", enabled: true },
  tuesday:   { open: "08:00", close: "22:00", enabled: true },
  wednesday: { open: "08:00", close: "22:00", enabled: true },
  thursday:  { open: "08:00", close: "22:00", enabled: true },
  friday:    { open: "08:00", close: "22:00", enabled: true },
  saturday:  { open: "09:00", close: "18:00", enabled: false },
  sunday:    { open: "09:00", close: "18:00", enabled: false },
};

// ─── Types ────────────────────────────────────────────────────────────────────

interface Branch {
  id: string; name: string; address: string; city: string;
  phone: string | null; lat: number; lng: number; type: string;
  is_active: boolean;
  opening_hours: {
    slot_duration: number;
    slot_capacity: number;
    days?: WeekSchedule;
    // compat ancien format
    open?: string; close?: string;
  } | null;
}

// ─── Schéma (sans les jours — gérés séparément) ───────────────────────────────

const BranchSchema = z.object({
  name: z.string().min(1),
  address: z.string().min(1),
  city: z.string().min(1),
  phone: z.string().optional(),
  type: z.string().default("other"),
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
  slot_duration: z.coerce.number().int().min(15).max(120).default(30),
  slot_capacity: z.coerce.number().int().min(1).max(100).default(5),
});
type BranchForm = z.infer<typeof BranchSchema>;

// ─── Helper affichage jours ───────────────────────────────────────────────────

function enabledDaysLabel(schedule: WeekSchedule | undefined): string {
  if (!schedule) return "Horaires non définis";
  const enabled = WEEK_DAYS.filter((d) => schedule[d.key]?.enabled);
  if (enabled.length === 0) return "Aucun jour actif";
  if (enabled.length === 7) return "Tous les jours";
  return enabled.map((d) => d.label.slice(0, 3)).join(", ");
}

// ─── Composant principal ──────────────────────────────────────────────────────

export default function BranchesPage() {
  const t = useTranslations("branches");
  const qc = useQueryClient();
  const router = useRouter();
  const params = useParams();
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Branch | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Branch | null>(null);
  const [schedule, setSchedule] = useState<WeekSchedule>(DEFAULT_WEEK_SCHEDULE);

  const { data: branches, isLoading } = useQuery<Branch[]>({
    queryKey: ["branches"],
    queryFn: () => apiGet("/branches"),
  });

  const { register, handleSubmit, reset, setValue, watch, formState: { isSubmitting } } = useForm<BranchForm>({
    resolver: zodResolver(BranchSchema),
    defaultValues: { type: "other", slot_duration: 30, slot_capacity: 5 },
  });
  const watchedType = watch("type", "other");

  // ── Helpers schedule ────────────────────────────────────────────────────────

  const setDay = (day: DayKey, field: keyof DaySchedule, value: string | boolean) => {
    setSchedule((prev) => ({ ...prev, [day]: { ...prev[day], [field]: value } }));
  };

  const applyToAll = (source: DayKey) => {
    const src = schedule[source];
    setSchedule((prev) => {
      const next = { ...prev };
      WEEK_DAYS.forEach(({ key }) => {
        next[key] = { ...next[key], open: src.open, close: src.close };
      });
      return next;
    });
  };

  // ── Mutations ───────────────────────────────────────────────────────────────

  const saveMutation = useMutation({
    mutationFn: (d: BranchForm) => {
      const { slot_duration, slot_capacity, ...rest } = d;
      const payload = {
        ...rest,
        opening_hours: { slot_duration, slot_capacity, days: schedule },
      };
      return editing ? apiPatch(`/branches/${editing.id}`, payload) : apiPost("/branches", payload);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["branches"] });
      toast.success(editing ? "Agence modifiée" : "Agence créée");
      setShowModal(false); reset(); setEditing(null); setSchedule(DEFAULT_WEEK_SCHEDULE);
    },
    onError: () => toast.error("Erreur"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiDelete(`/branches/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["branches"] }); toast.success("Agence supprimée"); setDeleteTarget(null); },
    onError: () => toast.error("Erreur"),
  });

  const toggleMutation = useMutation({
    mutationFn: (b: Branch) => apiPatch(`/branches/${b.id}`, { is_active: !b.is_active }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["branches"] }),
  });

  // ── Ouvrir modal ────────────────────────────────────────────────────────────

  const openCreate = () => {
    reset();
    setEditing(null);
    setSchedule(DEFAULT_WEEK_SCHEDULE);
    setShowModal(true);
  };

  const openEdit = (b: Branch) => {
    setEditing(b);
    setValue("name", b.name);
    setValue("address", b.address);
    setValue("city", b.city);
    setValue("phone", b.phone ?? "");
    setValue("type", b.type);
    setValue("lat", b.lat);
    setValue("lng", b.lng);
    setValue("slot_duration", b.opening_hours?.slot_duration ?? 30);
    setValue("slot_capacity", b.opening_hours?.slot_capacity ?? 5);

    // Compat ancien format → convertir en schedule hebdo
    if (b.opening_hours?.days) {
      setSchedule(b.opening_hours.days);
    } else if (b.opening_hours?.open) {
      // ancien format plat → appliquer à tous les jours
      const open = b.opening_hours.open;
      const close = b.opening_hours.close ?? "22:00";
      const converted: WeekSchedule = {} as WeekSchedule;
      WEEK_DAYS.forEach(({ key }) => {
        converted[key] = { open, close, enabled: key !== "sunday" };
      });
      setSchedule(converted);
    } else {
      setSchedule(DEFAULT_WEEK_SCHEDULE);
    }
    setShowModal(true);
  };

  // ─────────────────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{t("title")}</h1>
          <p className="text-sm text-slate-400">{t("subtitle")}</p>
        </div>
        <Button onClick={openCreate}><Plus className="h-4 w-4" />{t("addBranch")}</Button>
      </div>

      {/* Grille d'agences */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {isLoading
          ? Array.from({ length: 6 }).map((_, i) => (
              <Card key={i}><CardContent className="p-5"><Skeleton className="h-32 w-full" /></CardContent></Card>
            ))
          : (branches ?? []).map((b) => (
              <Card key={b.id} className={b.is_active ? "" : "opacity-60"}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-xl bg-brand-500/10 border border-brand-500/20 flex items-center justify-center">
                        <Store className="h-5 w-5 text-brand-400" />
                      </div>
                      <div>
                        <CardTitle className="text-base">{b.name}</CardTitle>
                        <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                          <Badge variant={b.is_active ? "active" : "inactive"}>
                            {b.is_active ? "Actif" : "Inactif"}
                          </Badge>
                          <span className="text-xs text-slate-500">
                            {BRANCH_TYPE_OPTIONS.find((o) => o.value === b.type)?.label ?? "📦 Autre"}
                          </span>
                        </div>
                      </div>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon-sm"><MoreHorizontal className="h-4 w-4" /></Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => router.push(`/${params.locale}/branches/${b.id}`)}>
                          <Package className="mr-2 h-4 w-4 text-brand-400" />Gérer les produits
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => openEdit(b)}><Pencil className="mr-2 h-4 w-4" />Modifier</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => toggleMutation.mutate(b)}>
                          {b.is_active ? "Désactiver" : "Activer"}
                        </DropdownMenuItem>
                        <DropdownMenuItem destructive onClick={() => setDeleteTarget(b)}>
                          <Trash2 className="mr-2 h-4 w-4" />Supprimer
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex items-center gap-2 text-sm text-slate-400">
                    <MapPin className="h-3.5 w-3.5 text-slate-600 shrink-0" />
                    <span>{b.address}, {b.city}</span>
                  </div>
                  {b.phone && (
                    <div className="flex items-center gap-2 text-sm text-slate-400">
                      <Phone className="h-3.5 w-3.5 text-slate-600 shrink-0" />
                      <span>{b.phone}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2 text-sm text-slate-400">
                    <Clock className="h-3.5 w-3.5 text-slate-600 shrink-0" />
                    <span className="text-xs">
                      {b.opening_hours
                        ? `${enabledDaysLabel(b.opening_hours.days)} · ${b.opening_hours.slot_duration}min · ${b.opening_hours.slot_capacity} places`
                        : "Horaires non définis"}
                    </span>
                  </div>
                  <Button
                    size="sm" variant="outline" className="w-full mt-3"
                    onClick={() => router.push(`/${params.locale}/branches/${b.id}`)}
                  >
                    <Package className="h-3.5 w-3.5 mr-2" />Gérer les produits
                  </Button>
                </CardContent>
              </Card>
            ))}
      </div>

      {/* Modal agence */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? t("edit") : t("addBranch")}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit((d) => saveMutation.mutate(d))} className="space-y-5">

            {/* Infos de base */}
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2 space-y-1.5">
                <Label>{t("name")}</Label>
                <Input {...register("name")} placeholder="Nom de l'agence" />
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label>Type d'établissement</Label>
                <Select value={watchedType} onValueChange={(v) => setValue("type", v)}>
                  <SelectTrigger><SelectValue placeholder="Choisir un type..." /></SelectTrigger>
                  <SelectContent>
                    {BRANCH_TYPE_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label>{t("address")}</Label>
                <Input {...register("address")} placeholder="Adresse complète" />
              </div>
              <div className="space-y-1.5">
                <Label>{t("city")}</Label>
                <Input {...register("city")} placeholder="Ville" />
              </div>
              <div className="space-y-1.5">
                <Label>{t("phone")}</Label>
                <Input {...register("phone")} placeholder="+237 6XX XXX XXX" />
              </div>
              <div className="space-y-1.5">
                <Label>Latitude</Label>
                <Input {...register("lat")} type="number" step="any" placeholder="3.8480" />
              </div>
              <div className="space-y-1.5">
                <Label>Longitude</Label>
                <Input {...register("lng")} type="number" step="any" placeholder="11.5021" />
              </div>
            </div>

            {/* Planning hebdomadaire */}
            <div className="border border-slate-200 rounded-lg p-4 space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5" /> Planning Click &amp; Collect
                </p>
                <div className="flex items-center gap-3">
                  <div className="space-y-1">
                    <span className="text-xs text-slate-500">Durée créneau</span>
                    <Select
                      value={String(watch("slot_duration"))}
                      onValueChange={(v) => setValue("slot_duration", Number(v))}
                    >
                      <SelectTrigger className="h-7 text-xs w-24"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {[15, 30, 45, 60].map((d) => (
                          <SelectItem key={d} value={String(d)}>{d} min</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <span className="text-xs text-slate-500">Places / créneau</span>
                    <Input
                      {...register("slot_capacity")}
                      type="number" min={1} max={100}
                      className="h-7 text-xs w-20"
                    />
                  </div>
                </div>
              </div>

              {/* Tableau par jour */}
              <div className="space-y-2">
                {WEEK_DAYS.map(({ key, label }) => (
                  <div
                    key={key}
                    className={`grid grid-cols-[100px_1fr_1fr_auto] items-center gap-3 rounded-md px-3 py-2 transition-colors ${
                      schedule[key].enabled ? "bg-slate-50" : "bg-white opacity-50"
                    }`}
                  >
                    {/* Jour + toggle */}
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={schedule[key].enabled}
                        onCheckedChange={(v) => setDay(key, "enabled", v)}
                      />
                      <span className="text-sm font-medium text-slate-900">{label}</span>
                    </div>

                    {/* Heure ouverture */}
                    <div className="space-y-0.5">
                      <span className="text-[10px] text-slate-500">Ouverture</span>
                      <Input
                        type="time"
                        value={schedule[key].open}
                        onChange={(e) => setDay(key, "open", e.target.value)}
                        disabled={!schedule[key].enabled}
                        className="h-7 text-xs"
                      />
                    </div>

                    {/* Heure fermeture */}
                    <div className="space-y-0.5">
                      <span className="text-[10px] text-slate-500">Fermeture</span>
                      <Input
                        type="time"
                        value={schedule[key].close}
                        onChange={(e) => setDay(key, "close", e.target.value)}
                        disabled={!schedule[key].enabled}
                        className="h-7 text-xs"
                      />
                    </div>

                    {/* Appliquer à tous */}
                    <button
                      type="button"
                      title="Appliquer ces horaires à tous les jours"
                      onClick={() => applyToAll(key)}
                      className="text-[10px] text-slate-500 hover:text-brand-400 transition-colors whitespace-nowrap"
                    >
                      ↕ Tous
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowModal(false)}>Annuler</Button>
              <Button type="submit" disabled={isSubmitting}>{isSubmitting ? "..." : "Enregistrer"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal confirmation suppression */}
      <Dialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Supprimer l'agence ?</DialogTitle>
            <DialogDescription>
              Cette action est irréversible. L'agence "{deleteTarget?.name}" sera supprimée.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Annuler</Button>
            <Button
              variant="destructive"
              onClick={() => deleteMutation.mutate(deleteTarget!.id)}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? "..." : "Supprimer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
