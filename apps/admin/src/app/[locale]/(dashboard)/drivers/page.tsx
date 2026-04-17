"use client";
import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { apiGet, apiPost, apiPatch, apiUpload } from "@/lib/api";
import { formatDateTime } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import {
  UserCheck, Plus, MoreHorizontal, RefreshCw, Phone, Store,
  Power, Key, Pencil, Bike, Camera, Loader2,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Branch { id: string; name: string }
interface Driver {
  id: string; name: string; phone: string;
  branch_id: string | null; brand_id: string | null;
  is_active: boolean; created_at: string;
  photo_url: string | null;
  branches: { name: string } | null;
}

// ─── Schemas ──────────────────────────────────────────────────────────────────

const CreateDriverSchema = z.object({
  name:      z.string().min(2, "Nom requis"),
  phone:     z.string().min(8, "Numéro invalide"),
  branch_id: z.string().optional(),
  pin:       z.string().length(4, "Le PIN doit faire exactement 4 chiffres").regex(/^\d+$/, "PIN numérique uniquement"),
});

const SetPinSchema = z.object({
  pin: z.string().length(4, "4 chiffres requis").regex(/^\d+$/, "Chiffres uniquement"),
});

type CreateDriverInput = z.infer<typeof CreateDriverSchema>;
type SetPinInput = z.infer<typeof SetPinSchema>;

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function DriversPage() {
  const qc = useQueryClient();

  const [showCreate, setShowCreate] = useState(false);
  const [pinTarget, setPinTarget] = useState<Driver | null>(null);
  const [editTarget, setEditTarget] = useState<Driver | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [photoUploading, setPhotoUploading] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);

  // ── Données ─────────────────────────────────────────────────────────────────
  const { data: drivers = [], isLoading, refetch } = useQuery<Driver[]>({
    queryKey: ["drivers"],
    queryFn: () => apiGet("/admins/drivers"),
    staleTime: 30_000,
  });

  const { data: branches = [] } = useQuery<Branch[]>({
    queryKey: ["branches-list"],
    queryFn: () => apiGet("/branches"),
    staleTime: 60_000,
  });

  // ── Création ────────────────────────────────────────────────────────────────
  const createForm = useForm<CreateDriverInput>({ resolver: zodResolver(CreateDriverSchema) });

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoUploading(true);
    try {
      const result = await apiUpload<{ url: string }>("/admins/drivers/upload-photo", file, "photo");
      setPhotoUrl(result.url);
    } catch {
      toast.error("Erreur lors de l'upload de la photo");
    } finally {
      setPhotoUploading(false);
    }
  };

  const createMutation = useMutation({
    mutationFn: (data: CreateDriverInput) => apiPost("/admins/drivers", { ...data, photo_url: photoUrl }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["drivers"] });
      toast.success("Livreur créé avec succès");
      setShowCreate(false);
      setPhotoUrl(null);
      createForm.reset();
    },
    onError: (e: any) => toast.error(e?.response?.data?.error?.message ?? "Erreur de création"),
  });

  // ── Modifier ────────────────────────────────────────────────────────────────
  const editForm = useForm<Omit<CreateDriverInput, "pin">>({
    resolver: zodResolver(CreateDriverSchema.omit({ pin: true })),
  });

  const editMutation = useMutation({
    mutationFn: (data: object) => apiPatch(`/admins/drivers/${editTarget?.id}`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["drivers"] });
      toast.success("Livreur mis à jour");
      setEditTarget(null);
      editForm.reset();
    },
    onError: (e: any) => toast.error(e?.response?.data?.error?.message ?? "Erreur"),
  });

  const openEdit = (d: Driver) => {
    setEditTarget(d);
    editForm.reset({ name: d.name, phone: d.phone, branch_id: d.branch_id ?? undefined });
  };

  // ── PIN ──────────────────────────────────────────────────────────────────────
  const pinForm = useForm<SetPinInput>({ resolver: zodResolver(SetPinSchema) });

  const pinMutation = useMutation({
    mutationFn: (data: SetPinInput) => apiPatch(`/admins/drivers/${pinTarget?.id}/pin`, data),
    onSuccess: () => {
      toast.success("PIN mis à jour");
      setPinTarget(null);
      pinForm.reset();
    },
    onError: (e: any) => toast.error(e?.response?.data?.error?.message ?? "Erreur"),
  });

  // ── Toggle actif ─────────────────────────────────────────────────────────────
  const toggleMutation = useMutation({
    mutationFn: (id: string) => apiPatch(`/admins/drivers/${id}/toggle-active`, {}),
    onSuccess: (_, id) => {
      qc.invalidateQueries({ queryKey: ["drivers"] });
      const d = drivers.find((x) => x.id === id);
      toast.success(d?.is_active ? "Livreur suspendu" : "Livreur réactivé");
    },
    onError: () => toast.error("Erreur"),
  });

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Bike className="h-6 w-6 text-brand-400" />
            Livreurs
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Gérez vos livreurs, assignez-leur des livraisons et configurez leurs accès.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={() => refetch()} className="gap-1.5 text-slate-400">
            <RefreshCw className="h-3.5 w-3.5" />
            Actualiser
          </Button>
          <Button size="sm" onClick={() => setShowCreate(true)} className="gap-1.5">
            <Plus className="h-4 w-4" />
            Ajouter un livreur
          </Button>
        </div>
      </div>

      {/* Stats rapides */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Total livreurs",  value: drivers.length,                          color: "text-white" },
          { label: "Actifs",          value: drivers.filter((d) => d.is_active).length, color: "text-green-400" },
          { label: "Suspendus",       value: drivers.filter((d) => !d.is_active).length, color: "text-red-400" },
        ].map((stat) => (
          <Card key={stat.label} className="bg-surface-800 border-surface-700">
            <CardContent className="p-4">
              <p className="text-sm text-slate-400">{stat.label}</p>
              <p className={`text-2xl font-bold mt-1 ${stat.color}`}>{stat.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Table */}
      <Card className="bg-surface-800 border-surface-700">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-3">
              {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-12 w-full bg-surface-700" />)}
            </div>
          ) : drivers.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-slate-500 gap-3">
              <Bike className="h-12 w-12 opacity-30" />
              <p className="text-sm">Aucun livreur enregistré</p>
              <Button size="sm" onClick={() => setShowCreate(true)} variant="outline" className="gap-1.5 border-surface-600">
                <Plus className="h-3.5 w-3.5" />
                Ajouter le premier livreur
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-surface-700 hover:bg-transparent">
                  <TableHead className="text-slate-400">Livreur</TableHead>
                  <TableHead className="text-slate-400">Téléphone</TableHead>
                  <TableHead className="text-slate-400">Agence</TableHead>
                  <TableHead className="text-slate-400">Statut</TableHead>
                  <TableHead className="text-slate-400">Créé le</TableHead>
                  <TableHead className="text-slate-400 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {drivers.map((driver) => (
                  <TableRow key={driver.id} className="border-surface-700 hover:bg-surface-750">
                    {/* Nom */}
                    <TableCell>
                      <div className="flex items-center gap-3">
                        {driver.photo_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={driver.photo_url} alt={driver.name} className="h-8 w-8 rounded-full object-cover" />
                        ) : (
                          <div className="h-8 w-8 rounded-full bg-brand-500/20 flex items-center justify-center text-brand-400 font-bold text-xs">
                            {driver.name.slice(0, 2).toUpperCase()}
                          </div>
                        )}
                        <span className="font-medium text-white">{driver.name}</span>
                      </div>
                    </TableCell>
                    {/* Téléphone */}
                    <TableCell>
                      <div className="flex items-center gap-1.5 text-slate-300 text-sm">
                        <Phone className="h-3.5 w-3.5 text-slate-500" />
                        {driver.phone}
                      </div>
                    </TableCell>
                    {/* Agence */}
                    <TableCell>
                      {driver.branches ? (
                        <div className="flex items-center gap-1.5 text-slate-300 text-sm">
                          <Store className="h-3.5 w-3.5 text-slate-500" />
                          {driver.branches.name}
                        </div>
                      ) : (
                        <span className="text-slate-600 text-sm">—</span>
                      )}
                    </TableCell>
                    {/* Statut */}
                    <TableCell>
                      <Badge variant={driver.is_active ? "delivered" : "cancelled"}>
                        {driver.is_active ? "Actif" : "Suspendu"}
                      </Badge>
                    </TableCell>
                    {/* Date */}
                    <TableCell className="text-slate-400 text-sm">
                      {formatDateTime(driver.created_at)}
                    </TableCell>
                    {/* Actions */}
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-400 hover:text-white">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="bg-surface-800 border-surface-700 text-white">
                          <DropdownMenuItem onClick={() => openEdit(driver)} className="gap-2 hover:bg-surface-700 cursor-pointer">
                            <Pencil className="h-3.5 w-3.5 text-slate-400" />
                            Modifier
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => { setPinTarget(driver); pinForm.reset(); }} className="gap-2 hover:bg-surface-700 cursor-pointer">
                            <Key className="h-3.5 w-3.5 text-slate-400" />
                            Changer le PIN
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => toggleMutation.mutate(driver.id)}
                            className={`gap-2 cursor-pointer ${driver.is_active ? "hover:bg-red-500/10 text-red-400" : "hover:bg-green-500/10 text-green-400"}`}
                          >
                            <Power className="h-3.5 w-3.5" />
                            {driver.is_active ? "Suspendre" : "Réactiver"}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* ── Modal création ──────────────────────────────────────────────────── */}
      <Dialog open={showCreate} onOpenChange={(o) => { setShowCreate(o); if (!o) { setPhotoUrl(null); createForm.reset(); } }}>
        <DialogContent className="bg-surface-800 border-surface-700 text-white max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserCheck className="h-5 w-5 text-brand-400" />
              Ajouter un livreur
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={createForm.handleSubmit((d) => createMutation.mutate(d))} className="space-y-4">
            {/* Photo */}
            <div className="flex flex-col items-center gap-3">
              <input ref={photoInputRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} />
              <button
                type="button"
                onClick={() => photoInputRef.current?.click()}
                className="relative group"
                disabled={photoUploading}
              >
                {photoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={photoUrl} alt="Photo livreur" className="h-20 w-20 rounded-full object-cover ring-2 ring-brand-500" />
                ) : (
                  <div className="h-20 w-20 rounded-full bg-surface-700 border-2 border-dashed border-surface-500 flex flex-col items-center justify-center gap-1 group-hover:border-brand-500 transition-colors">
                    {photoUploading ? <Loader2 className="h-5 w-5 text-brand-400 animate-spin" /> : <Camera className="h-5 w-5 text-slate-500" />}
                    {!photoUploading && <span className="text-xs text-slate-500">Photo</span>}
                  </div>
                )}
                {photoUrl && (
                  <div className="absolute inset-0 rounded-full bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <Camera className="h-5 w-5 text-white" />
                  </div>
                )}
              </button>
              <p className="text-xs text-slate-500">Photo du livreur (optionnel)</p>
            </div>
            <div>
              <Label className="text-slate-300">Nom complet</Label>
              <Input {...createForm.register("name")} placeholder="Jean Dupont" className="mt-1.5 bg-surface-700 border-surface-600 text-white" />
              {createForm.formState.errors.name && (
                <p className="text-xs text-red-400 mt-1">{createForm.formState.errors.name.message}</p>
              )}
            </div>
            <div>
              <Label className="text-slate-300">Téléphone</Label>
              <Input {...createForm.register("phone")} placeholder="+237 6XX XXX XXX" className="mt-1.5 bg-surface-700 border-surface-600 text-white" />
              {createForm.formState.errors.phone && (
                <p className="text-xs text-red-400 mt-1">{createForm.formState.errors.phone.message}</p>
              )}
            </div>
            <div>
              <Label className="text-slate-300">Agence rattachée (optionnel)</Label>
              <Select onValueChange={(v) => createForm.setValue("branch_id", v)}>
                <SelectTrigger className="mt-1.5 bg-surface-700 border-surface-600 text-white">
                  <SelectValue placeholder="Sélectionner une agence…" />
                </SelectTrigger>
                <SelectContent className="bg-surface-800 border-surface-700 text-white">
                  {branches.map((b) => (
                    <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-slate-300">PIN de connexion (4 chiffres)</Label>
              <Input
                {...createForm.register("pin")}
                type="password"
                inputMode="numeric"
                maxLength={4}
                placeholder="••••"
                className="mt-1.5 bg-surface-700 border-surface-600 text-white tracking-widest text-center text-lg"
              />
              {createForm.formState.errors.pin && (
                <p className="text-xs text-red-400 mt-1">{createForm.formState.errors.pin.message}</p>
              )}
              <p className="text-xs text-slate-500 mt-1">Le livreur utilise ce PIN pour se connecter à l'app mobile.</p>
            </div>
            <DialogFooter className="gap-2 pt-2">
              <Button type="button" variant="ghost" onClick={() => setShowCreate(false)} className="text-slate-400">
                Annuler
              </Button>
              <Button type="submit" disabled={createMutation.isPending} className="gap-1.5">
                {createMutation.isPending ? "Création…" : "Créer le livreur"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Modal modification ──────────────────────────────────────────────── */}
      <Dialog open={!!editTarget} onOpenChange={(o) => !o && setEditTarget(null)}>
        <DialogContent className="bg-surface-800 border-surface-700 text-white max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="h-5 w-5 text-brand-400" />
              Modifier {editTarget?.name}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={editForm.handleSubmit((d) => editMutation.mutate(d))} className="space-y-4">
            <div>
              <Label className="text-slate-300">Nom complet</Label>
              <Input {...editForm.register("name")} className="mt-1.5 bg-surface-700 border-surface-600 text-white" />
            </div>
            <div>
              <Label className="text-slate-300">Téléphone</Label>
              <Input {...editForm.register("phone")} className="mt-1.5 bg-surface-700 border-surface-600 text-white" />
            </div>
            <div>
              <Label className="text-slate-300">Agence</Label>
              <Select
                defaultValue={editTarget?.branch_id ?? undefined}
                onValueChange={(v) => editForm.setValue("branch_id", v)}
              >
                <SelectTrigger className="mt-1.5 bg-surface-700 border-surface-600 text-white">
                  <SelectValue placeholder="Aucune agence" />
                </SelectTrigger>
                <SelectContent className="bg-surface-800 border-surface-700 text-white">
                  {branches.map((b) => (
                    <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <DialogFooter className="gap-2 pt-2">
              <Button type="button" variant="ghost" onClick={() => setEditTarget(null)} className="text-slate-400">Annuler</Button>
              <Button type="submit" disabled={editMutation.isPending}>
                {editMutation.isPending ? "Enregistrement…" : "Enregistrer"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Modal PIN ────────────────────────────────────────────────────────── */}
      <Dialog open={!!pinTarget} onOpenChange={(o) => !o && setPinTarget(null)}>
        <DialogContent className="bg-surface-800 border-surface-700 text-white max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Key className="h-5 w-5 text-brand-400" />
              Nouveau PIN — {pinTarget?.name}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={pinForm.handleSubmit((d) => pinMutation.mutate(d))} className="space-y-4">
            <div>
              <Label className="text-slate-300">PIN (4 chiffres)</Label>
              <Input
                {...pinForm.register("pin")}
                type="password"
                inputMode="numeric"
                maxLength={4}
                placeholder="••••"
                className="mt-1.5 bg-surface-700 border-surface-600 text-white tracking-widest text-center text-2xl"
                autoFocus
              />
              {pinForm.formState.errors.pin && (
                <p className="text-xs text-red-400 mt-1">{pinForm.formState.errors.pin.message}</p>
              )}
            </div>
            <DialogFooter className="gap-2 pt-2">
              <Button type="button" variant="ghost" onClick={() => setPinTarget(null)} className="text-slate-400">Annuler</Button>
              <Button type="submit" disabled={pinMutation.isPending}>
                {pinMutation.isPending ? "Enregistrement…" : "Mettre à jour le PIN"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
