"use client";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { apiGet, apiPost, apiPatch } from "@/lib/api";
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
import { Plus, MoreHorizontal, Key, Power, UsersRound, Store, Phone } from "lucide-react";

interface Branch { id: string; name: string }
interface BranchManager {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  branch_id: string;
  is_active: boolean;
  created_at: string;
  branches: { name: string } | null;
}

const CreateSchema = z.object({
  name:      z.string().min(2, "Nom requis"),
  phone:     z.string().min(8, "Numéro invalide"),
  email:     z.string().email().optional().or(z.literal("")),
  branch_id: z.string().min(1, "Agence requise"),
  password:  z.string().min(6, "Mot de passe minimum 6 caractères"),
});

const ResetSchema = z.object({
  new_password: z.string().min(6, "Minimum 6 caractères"),
});

type CreateInput = z.infer<typeof CreateSchema>;
type ResetInput = z.infer<typeof ResetSchema>;

export default function BranchManagersPage() {
  const qc = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [resetTarget, setResetTarget] = useState<BranchManager | null>(null);

  const { data: managers = [], isLoading } = useQuery<BranchManager[]>({
    queryKey: ["branch-managers"],
    queryFn: () => apiGet("/branch-managers"),
    select: (d: any) => Array.isArray(d) ? d : d?.data ?? [],
  });

  const { data: branches = [] } = useQuery<Branch[]>({
    queryKey: ["branches-list"],
    queryFn: () => apiGet("/branches"),
  });

  const createForm = useForm<CreateInput>({ resolver: zodResolver(CreateSchema) });
  const resetForm  = useForm<ResetInput>({ resolver: zodResolver(ResetSchema) });

  const createMutation = useMutation({
    mutationFn: (d: CreateInput) => apiPost("/branch-managers", { ...d, email: d.email || undefined }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["branch-managers"] });
      toast.success("Manager créé avec succès");
      setShowCreate(false);
      createForm.reset();
    },
    onError: (e: any) => toast.error(e?.response?.data?.error?.message ?? "Erreur de création"),
  });

  const toggleMutation = useMutation({
    mutationFn: (m: BranchManager) => apiPatch(`/branch-managers/${m.id}`, { is_active: !m.is_active }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["branch-managers"] }),
    onError: () => toast.error("Erreur"),
  });

  const resetMutation = useMutation({
    mutationFn: (d: ResetInput) => apiPost(`/branch-managers/${resetTarget?.id}/reset-password`, d),
    onSuccess: () => {
      toast.success("Mot de passe réinitialisé");
      setResetTarget(null);
      resetForm.reset();
    },
    onError: (e: any) => toast.error(e?.response?.data?.error?.message ?? "Erreur"),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <UsersRound className="h-6 w-6 text-brand-500" />
            Managers d'agence
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Créez et gérez les accès des responsables de chaque agence.
          </p>
        </div>
        <Button onClick={() => setShowCreate(true)} className="gap-1.5">
          <Plus className="h-4 w-4" />
          Nouveau manager
        </Button>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Total managers", value: managers.length,                            color: "text-slate-900" },
          { label: "Actifs",         value: managers.filter((m) => m.is_active).length, color: "text-green-600" },
          { label: "Suspendus",      value: managers.filter((m) => !m.is_active).length, color: "text-red-500" },
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
              {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : managers.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-slate-500 gap-3">
              <UsersRound className="h-12 w-12 opacity-20" />
              <p className="text-sm">Aucun manager d'agence</p>
              <Button size="sm" variant="outline" onClick={() => setShowCreate(true)} className="gap-1.5">
                <Plus className="h-3.5 w-3.5" />Créer le premier manager
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Manager</TableHead>
                  <TableHead>Téléphone</TableHead>
                  <TableHead>Agence</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {managers.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-full bg-brand-100 flex items-center justify-center text-brand-700 font-bold text-xs">
                          {m.name.slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-medium text-slate-900">{m.name}</p>
                          {m.email && <p className="text-xs text-slate-400">{m.email}</p>}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5 text-sm text-slate-700">
                        <Phone className="h-3.5 w-3.5 text-slate-400" />{m.phone}
                      </div>
                    </TableCell>
                    <TableCell>
                      {m.branches ? (
                        <div className="flex items-center gap-1.5 text-sm text-slate-700">
                          <Store className="h-3.5 w-3.5 text-slate-400" />{m.branches.name}
                        </div>
                      ) : "—"}
                    </TableCell>
                    <TableCell>
                      <Badge className={m.is_active ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}>
                        {m.is_active ? "Actif" : "Suspendu"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-7 w-7">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => { setResetTarget(m); resetForm.reset(); }} className="gap-2">
                            <Key className="h-3.5 w-3.5" />Réinitialiser mot de passe
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => toggleMutation.mutate(m)}
                            className={`gap-2 ${m.is_active ? "text-red-600" : "text-green-600"}`}
                          >
                            <Power className="h-3.5 w-3.5" />
                            {m.is_active ? "Suspendre" : "Réactiver"}
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

      {/* Create modal */}
      <Dialog open={showCreate} onOpenChange={(o) => { setShowCreate(o); if (!o) createForm.reset(); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UsersRound className="h-5 w-5 text-brand-500" />
              Nouveau manager d'agence
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={createForm.handleSubmit((d) => createMutation.mutate(d))} className="space-y-4">
            <div className="space-y-1.5">
              <Label>Nom complet</Label>
              <Input {...createForm.register("name")} placeholder="Jean Kamdem" />
              {createForm.formState.errors.name && (
                <p className="text-xs text-red-500">{createForm.formState.errors.name.message}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>Téléphone</Label>
              <Input {...createForm.register("phone")} placeholder="+237 6XX XXX XXX" />
              {createForm.formState.errors.phone && (
                <p className="text-xs text-red-500">{createForm.formState.errors.phone.message}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>Email (optionnel)</Label>
              <Input {...createForm.register("email")} type="email" placeholder="manager@agence.com" />
            </div>
            <div className="space-y-1.5">
              <Label>Agence</Label>
              <Select onValueChange={(v) => createForm.setValue("branch_id", v)}>
                <SelectTrigger><SelectValue placeholder="Sélectionner une agence..." /></SelectTrigger>
                <SelectContent>
                  {branches.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                </SelectContent>
              </Select>
              {createForm.formState.errors.branch_id && (
                <p className="text-xs text-red-500">{createForm.formState.errors.branch_id.message}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>Mot de passe de connexion</Label>
              <Input {...createForm.register("password")} type="password" placeholder="••••••••" />
              {createForm.formState.errors.password && (
                <p className="text-xs text-red-500">{createForm.formState.errors.password.message}</p>
              )}
              <p className="text-xs text-slate-400">Le manager utilisera son téléphone + ce mot de passe pour se connecter.</p>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowCreate(false)}>Annuler</Button>
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending ? "Création..." : "Créer le manager"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Reset password modal */}
      <Dialog open={!!resetTarget} onOpenChange={(o) => !o && setResetTarget(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Key className="h-5 w-5 text-brand-500" />
              Nouveau mot de passe — {resetTarget?.name}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={resetForm.handleSubmit((d) => resetMutation.mutate(d))} className="space-y-4">
            <div className="space-y-1.5">
              <Label>Nouveau mot de passe</Label>
              <Input {...resetForm.register("new_password")} type="password" placeholder="••••••••" autoFocus />
              {resetForm.formState.errors.new_password && (
                <p className="text-xs text-red-500">{resetForm.formState.errors.new_password.message}</p>
              )}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setResetTarget(null)}>Annuler</Button>
              <Button type="submit" disabled={resetMutation.isPending}>
                {resetMutation.isPending ? "..." : "Réinitialiser"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
