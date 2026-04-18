"use client";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { apiGet, apiPost, apiPatch } from "@/lib/api";
import { formatDateTime } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search, MoreHorizontal, Building2, RefreshCw, ShieldOff, ShieldCheck, Plus } from "lucide-react";

interface Brand {
  id: string; name: string; logo_url: string | null; is_active: boolean;
  created_at: string; description: string | null;
  admins?: { username: string; email: string }[];
  branches?: { id: string }[];
}

export default function SuperAdminBrandsPage() {
  const t = useTranslations("brands");
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [confirm, setConfirm] = useState<{ brand: Brand; action: "suspend" | "activate" } | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: "", description: "", logo_url: "" });

  const { data, isLoading, refetch } = useQuery<Brand[]>({
    queryKey: ["sa-brands", { search }],
    queryFn: () => apiGet<Brand[]>("/brands", search ? { q: search } : undefined),
  });

  const brands = (data ?? []).filter((b) =>
    search ? b.name.toLowerCase().includes(search.toLowerCase()) : true
  );

  const createMutation = useMutation({
    mutationFn: () => apiPost("/brands", {
      name: form.name,
      ...(form.description && { description: form.description }),
      ...(form.logo_url && { logo_url: form.logo_url }),
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sa-brands"] });
      toast.success("Marque créée avec succès");
      setShowCreate(false);
      setForm({ name: "", description: "", logo_url: "" });
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.error?.message ?? "Erreur lors de la création";
      toast.error(msg);
    },
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, is_active }: { id: string; is_active: boolean }) =>
      is_active
        ? apiPatch(`/brands/${id}/suspend`, {})
        : apiPatch(`/brands/${id}`, { is_active: true }),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["sa-brands"] });
      toast.success(vars.is_active ? "Marque suspendue" : "Marque réactivée");
      setConfirm(null);
    },
    onError: () => toast.error("Erreur"),
  });

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{t("title")}</h1>
          <p className="text-sm text-slate-400">{t("subtitle")}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={() => refetch()}><RefreshCw className="h-4 w-4" /></Button>
          <Button onClick={() => setShowCreate(true)}>
            <Plus className="h-4 w-4" />{t("addBrand")}
          </Button>
        </div>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
        <Input
          placeholder="Rechercher une marque..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("name")}</TableHead>
              <TableHead>{t("admin")}</TableHead>
              <TableHead>{t("branches")}</TableHead>
              <TableHead>{t("status")}</TableHead>
              <TableHead>Créée le</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading
              ? Array.from({ length: 8 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 6 }).map((_, j) => (
                      <TableCell key={j}><Skeleton className="h-5 w-full" /></TableCell>
                    ))}
                  </TableRow>
                ))
              : brands.map((b) => (
                  <TableRow key={b.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-lg bg-slate-50 flex items-center justify-center overflow-hidden shrink-0">
                          {b.logo_url ? (
                            <img src={b.logo_url} alt={b.name} className="h-full w-full object-cover" />
                          ) : (
                            <Building2 className="h-4 w-4 text-slate-500" />
                          )}
                        </div>
                        <div>
                          <p className="font-medium text-slate-900">{b.name}</p>
                          <p className="text-xs font-mono text-slate-600">#{b.id.slice(0, 8)}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {b.admins?.[0] ? (
                        <div>
                          <p className="text-slate-900 text-sm">{b.admins[0].username}</p>
                          <p className="text-xs text-slate-500">{b.admins[0].email}</p>
                        </div>
                      ) : (
                        <span className="text-xs text-slate-500 italic">Aucun admin</span>
                      )}
                    </TableCell>
                    <TableCell className="text-slate-700">{b.branches?.length ?? 0} agences</TableCell>
                    <TableCell>
                      <Badge variant={b.is_active ? "active" : "inactive"}>
                        {b.is_active ? "Active" : "Suspendue"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-slate-500">{formatDateTime(b.created_at)}</TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon-sm"><MoreHorizontal className="h-4 w-4" /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {b.is_active ? (
                            <DropdownMenuItem onClick={() => setConfirm({ brand: b, action: "suspend" })}>
                              <ShieldOff className="mr-2 h-4 w-4 text-red-400" />{t("suspend")}
                            </DropdownMenuItem>
                          ) : (
                            <DropdownMenuItem onClick={() => setConfirm({ brand: b, action: "activate" })}>
                              <ShieldCheck className="mr-2 h-4 w-4 text-green-400" />{t("activate")}
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
          </TableBody>
        </Table>
        {!isLoading && brands.length === 0 && (
          <div className="p-8 text-center text-sm text-slate-500">Aucune marque enregistrée</div>
        )}
      </Card>

      {/* Créer marque */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Nouvelle marque</DialogTitle>
            <DialogDescription>Créez une marque directement sans passer par une demande.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Nom de la marque <span className="text-red-400">*</span></Label>
              <Input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Ex : Mami Beignet, KFC Cameroun..."
              />
            </div>
            <div className="space-y-1.5">
              <Label>Description <span className="text-slate-500 text-xs">(optionnel)</span></Label>
              <Textarea
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="Courte description de la marque..."
                rows={2}
              />
            </div>
            <div className="space-y-1.5">
              <Label>URL du logo <span className="text-slate-500 text-xs">(optionnel)</span></Label>
              <Input
                value={form.logo_url}
                onChange={(e) => setForm((f) => ({ ...f, logo_url: e.target.value }))}
                placeholder="https://..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>Annuler</Button>
            <Button
              onClick={() => createMutation.mutate()}
              disabled={!form.name.trim() || createMutation.isPending}
            >
              {createMutation.isPending ? "..." : "Créer la marque"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmer suspend/activate */}
      <Dialog open={!!confirm} onOpenChange={() => setConfirm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {confirm?.action === "suspend" ? t("suspendConfirm") : "Réactiver la marque ?"}
            </DialogTitle>
            <DialogDescription>
              {confirm?.action === "suspend"
                ? `"${confirm.brand.name}" sera suspendue et ses admins ne pourront plus se connecter.`
                : `"${confirm?.brand.name}" sera réactivée.`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirm(null)}>Annuler</Button>
            <Button
              variant={confirm?.action === "suspend" ? "destructive" : "default"}
              onClick={() => toggleMutation.mutate({ id: confirm!.brand.id, is_active: confirm!.action === "suspend" })}
              disabled={toggleMutation.isPending}
            >
              {toggleMutation.isPending ? "..." : confirm?.action === "suspend" ? t("suspend") : t("activate")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
