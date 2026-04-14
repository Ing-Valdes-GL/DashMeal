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
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Plus, MoreHorizontal, Pencil, Trash2, MapPin, Phone, Clock, Store, Package } from "lucide-react";

interface Branch {
  id: string; name: string; address: string; city: string;
  phone: string | null; lat: number; lng: number;
  is_active: boolean; hours: Record<string, string>;
}

const BranchSchema = z.object({
  name: z.string().min(1),
  address: z.string().min(1),
  city: z.string().min(1),
  phone: z.string().optional(),
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
});
type BranchForm = z.infer<typeof BranchSchema>;

export default function BranchesPage() {
  const t = useTranslations("branches");
  const qc = useQueryClient();
  const router = useRouter();
  const params = useParams();
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Branch | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Branch | null>(null);

  const { data: branches, isLoading } = useQuery<Branch[]>({
    queryKey: ["branches"],
    queryFn: () => apiGet("/branches"),
  });

  const { register, handleSubmit, reset, setValue, formState: { isSubmitting } } = useForm<BranchForm>({
    resolver: zodResolver(BranchSchema),
  });

  const saveMutation = useMutation({
    mutationFn: (d: BranchForm) => editing
      ? apiPatch(`/branches/${editing.id}`, d)
      : apiPost("/branches", d),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["branches"] });
      toast.success(editing ? "Agence modifiée" : "Agence créée");
      setShowModal(false); reset(); setEditing(null);
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

  const openCreate = () => { reset(); setEditing(null); setShowModal(true); };
  const openEdit = (b: Branch) => {
    setEditing(b);
    (Object.keys(BranchSchema.shape) as (keyof BranchForm)[]).forEach((k) => {
      setValue(k, (b as any)[k] ?? "");
    });
    setShowModal(true);
  };

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">{t("title")}</h1>
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
                        <Badge variant={b.is_active ? "active" : "inactive"} className="mt-0.5">
                          {b.is_active ? "Actif" : "Inactif"}
                        </Badge>
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
                    <span className="text-xs">{Object.keys(b.hours ?? {}).length} créneaux horaires</span>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full mt-3"
                    onClick={() => router.push(`/${params.locale}/branches/${b.id}`)}
                  >
                    <Package className="h-3.5 w-3.5 mr-2" />
                    Gérer les produits
                  </Button>
                </CardContent>
              </Card>
            ))}
      </div>

      {/* Modal agence */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? t("edit") : t("addBranch")}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit((d) => saveMutation.mutate(d))} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2 space-y-1.5">
                <Label>{t("name")}</Label>
                <Input {...register("name")} placeholder="Nom de l'agence" />
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
            <Button variant="destructive" onClick={() => deleteMutation.mutate(deleteTarget!.id)}
              disabled={deleteMutation.isPending}>
              {deleteMutation.isPending ? "..." : "Supprimer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
