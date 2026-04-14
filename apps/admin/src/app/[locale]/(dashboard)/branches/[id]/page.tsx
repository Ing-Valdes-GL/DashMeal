"use client";
import { useState, use } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { apiGet, apiPost, apiPatch, apiDelete } from "@/lib/api";
import { formatCurrency } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  ArrowLeft, Plus, MoreHorizontal, Pencil, Trash2,
  Eye, EyeOff, Tag, Package, MapPin, RefreshCw,
} from "lucide-react";

interface Branch {
  id: string; name: string; address: string; city: string;
  phone: string | null; is_active: boolean;
}

interface Product {
  id: string; name_fr: string; name_en: string; price: number;
  image_url: string | null; is_active: boolean; is_hidden: boolean;
  promo_price: number | null; promo_ends_at: string | null;
  category_id: string | null; categories?: { name_fr: string };
  description_fr?: string; description_en?: string;
}

interface Category { id: string; name_fr: string }

const emptyForm = {
  name_fr: "", name_en: "", price: "",
  description_fr: "", description_en: "",
  image_url: "", category_id: "",
};

export default function BranchProductsPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id: branchId } = use(params);
  const router = useRouter();
  const qc = useQueryClient();

  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [promoTarget, setPromoTarget] = useState<Product | null>(null);
  const [promoForm, setPromoForm] = useState({ promo_price: "", promo_ends_at: "" });
  const [form, setForm] = useState(emptyForm);

  // Données
  const { data: branch, isLoading: branchLoading } = useQuery<Branch>({
    queryKey: ["branch", branchId],
    queryFn: () => apiGet<Branch>(`/branches/${branchId}`),
  });

  const { data: products, isLoading: productsLoading, refetch } = useQuery<Product[]>({
    queryKey: ["branch-products", branchId],
    queryFn: () => apiGet<Product[]>(`/products/branch/${branchId}`),
  });

  const { data: categories } = useQuery<Category[]>({
    queryKey: ["categories"],
    queryFn: () => apiGet<Category[]>("/products/categories"),
  });

  // Mutations
  const saveMutation = useMutation({
    mutationFn: (d: typeof form) => {
      const payload = {
        branch_id: branchId,
        name_fr: d.name_fr,
        name_en: d.name_en,
        price: Number(d.price),
        ...(d.description_fr && { description_fr: d.description_fr }),
        ...(d.description_en && { description_en: d.description_en }),
        ...(d.image_url && { image_url: d.image_url }),
        ...(d.category_id && { category_id: d.category_id }),
      };
      return editing
        ? apiPatch(`/products/${editing.id}`, payload)
        : apiPost("/products", payload);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["branch-products", branchId] });
      toast.success(editing ? "Produit modifié" : "Produit créé");
      setShowCreate(false);
      setEditing(null);
      setForm(emptyForm);
    },
    onError: (err: any) => toast.error(err?.response?.data?.error?.message ?? "Erreur"),
  });

  const toggleHiddenMutation = useMutation({
    mutationFn: (id: string) => apiPatch(`/products/${id}/toggle-hidden`, {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["branch-products", branchId] }),
    onError: () => toast.error("Erreur"),
  });

  const promoMutation = useMutation({
    mutationFn: ({ id, promo_price, promo_ends_at }: { id: string; promo_price: number | null; promo_ends_at: string | null }) =>
      apiPatch(`/products/${id}/promo`, { promo_price, promo_ends_at }),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["branch-products", branchId] });
      toast.success(vars.promo_price ? "Promo activée" : "Promo retirée");
      setPromoTarget(null);
      setPromoForm({ promo_price: "", promo_ends_at: "" });
    },
    onError: () => toast.error("Erreur"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiDelete(`/products/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["branch-products", branchId] });
      toast.success("Produit supprimé");
    },
    onError: () => toast.error("Erreur"),
  });

  const openEdit = (p: Product) => {
    setEditing(p);
    setForm({
      name_fr: p.name_fr,
      name_en: p.name_en,
      price: String(p.price),
      description_fr: p.description_fr ?? "",
      description_en: p.description_en ?? "",
      image_url: p.image_url ?? "",
      category_id: p.category_id ?? "",
    });
    setShowCreate(true);
  };

  const openPromo = (p: Product) => {
    setPromoTarget(p);
    setPromoForm({
      promo_price: p.promo_price ? String(p.promo_price) : "",
      promo_ends_at: p.promo_ends_at ? p.promo_ends_at.slice(0, 16) : "",
    });
  };

  const productsList = products ?? [];
  const activeCount = productsList.filter((p) => !p.is_hidden).length;
  const promoCount = productsList.filter((p) => p.promo_price !== null).length;

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => router.push(`/${locale}/branches`)}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            {branchLoading ? (
              <Skeleton className="h-7 w-48" />
            ) : (
              <>
                <h1 className="text-2xl font-bold text-white">{branch?.name}</h1>
                <p className="text-sm text-slate-400 flex items-center gap-1">
                  <MapPin className="h-3 w-3" /> {branch?.address}, {branch?.city}
                </p>
              </>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={() => refetch()}><RefreshCw className="h-4 w-4" /></Button>
          <Button onClick={() => { setEditing(null); setForm(emptyForm); setShowCreate(true); }}>
            <Plus className="h-4 w-4" />Nouveau produit
          </Button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-3">
        <Card><CardContent className="p-4 text-center">
          <p className="text-2xl font-bold text-white">{productsList.length}</p>
          <p className="text-xs text-slate-500 mt-1">Produits total</p>
        </CardContent></Card>
        <Card><CardContent className="p-4 text-center">
          <p className="text-2xl font-bold text-green-400">{activeCount}</p>
          <p className="text-xs text-slate-500 mt-1">Visibles</p>
        </CardContent></Card>
        <Card><CardContent className="p-4 text-center">
          <p className="text-2xl font-bold text-brand-400">{promoCount}</p>
          <p className="text-xs text-slate-500 mt-1">En promo</p>
        </CardContent></Card>
      </div>

      {/* Table produits */}
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Produit</TableHead>
              <TableHead>Catégorie</TableHead>
              <TableHead>Prix</TableHead>
              <TableHead>Promo</TableHead>
              <TableHead>Visibilité</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {productsLoading
              ? Array.from({ length: 6 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 6 }).map((_, j) => (
                      <TableCell key={j}><Skeleton className="h-5 w-full" /></TableCell>
                    ))}
                  </TableRow>
                ))
              : productsList.map((p) => (
                  <TableRow key={p.id} className={p.is_hidden ? "opacity-50" : ""}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-lg bg-surface-700 flex items-center justify-center overflow-hidden shrink-0">
                          {p.image_url ? (
                            <img src={p.image_url} alt={p.name_fr} className="h-full w-full object-cover" />
                          ) : (
                            <Package className="h-5 w-5 text-slate-600" />
                          )}
                        </div>
                        <div>
                          <p className="font-medium text-white">{p.name_fr}</p>
                          <p className="text-xs text-slate-500">{p.name_en}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-slate-400 text-sm">{p.categories?.name_fr ?? "—"}</TableCell>
                    <TableCell>
                      <div>
                        <p className={`font-semibold ${p.promo_price ? "line-through text-slate-500 text-sm" : "text-white"}`}>
                          {formatCurrency(p.price)}
                        </p>
                        {p.promo_price && (
                          <p className="text-brand-400 font-bold text-sm">{formatCurrency(p.promo_price)}</p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {p.promo_price ? (
                        <Badge variant="pending" className="text-xs">
                          <Tag className="h-3 w-3 mr-1" />
                          -{Math.round((1 - p.promo_price / p.price) * 100)}%
                        </Badge>
                      ) : (
                        <span className="text-xs text-slate-600">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={!p.is_hidden}
                          onCheckedChange={() => toggleHiddenMutation.mutate(p.id)}
                        />
                        <span className="text-xs text-slate-500">{p.is_hidden ? "Masqué" : "Visible"}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon-sm"><MoreHorizontal className="h-4 w-4" /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openEdit(p)}>
                            <Pencil className="mr-2 h-4 w-4" />Modifier
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => openPromo(p)}>
                            <Tag className="mr-2 h-4 w-4 text-brand-400" />
                            {p.promo_price ? "Modifier la promo" : "Ajouter une promo"}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => toggleHiddenMutation.mutate(p.id)}>
                            {p.is_hidden
                              ? <><Eye className="mr-2 h-4 w-4" />Rendre visible</>
                              : <><EyeOff className="mr-2 h-4 w-4" />Masquer</>}
                          </DropdownMenuItem>
                          {p.promo_price && (
                            <DropdownMenuItem onClick={() => promoMutation.mutate({ id: p.id, promo_price: null, promo_ends_at: null })}>
                              <Tag className="mr-2 h-4 w-4 text-red-400" />Retirer la promo
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem destructive onClick={() => {
                            if (confirm("Supprimer ce produit ?")) deleteMutation.mutate(p.id);
                          }}>
                            <Trash2 className="mr-2 h-4 w-4" />Supprimer
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
          </TableBody>
        </Table>
        {!productsLoading && productsList.length === 0 && (
          <div className="p-12 text-center">
            <Package className="h-10 w-10 text-slate-700 mx-auto mb-3" />
            <p className="text-sm text-slate-500">Aucun produit dans cette agence</p>
            <Button className="mt-4" onClick={() => { setEditing(null); setForm(emptyForm); setShowCreate(true); }}>
              <Plus className="h-4 w-4" />Ajouter le premier produit
            </Button>
          </div>
        )}
      </Card>

      {/* Modal créer/modifier produit */}
      <Dialog open={showCreate} onOpenChange={(v) => { setShowCreate(v); if (!v) { setEditing(null); setForm(emptyForm); } }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Modifier le produit" : "Nouveau produit"}</DialogTitle>
            {!editing && (
              <DialogDescription>
                Ce produit sera exclusivement disponible dans l'agence <strong>{branch?.name}</strong>.
              </DialogDescription>
            )}
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Nom (FR) <span className="text-red-400">*</span></Label>
                <Input value={form.name_fr} onChange={(e) => setForm((f) => ({ ...f, name_fr: e.target.value }))} placeholder="Nom en français" />
              </div>
              <div className="space-y-1.5">
                <Label>Nom (EN) <span className="text-red-400">*</span></Label>
                <Input value={form.name_en} onChange={(e) => setForm((f) => ({ ...f, name_en: e.target.value }))} placeholder="Name in English" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Prix (FCFA) <span className="text-red-400">*</span></Label>
                <Input type="number" value={form.price} onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))} placeholder="0" />
              </div>
              <div className="space-y-1.5">
                <Label>Catégorie</Label>
                <Select value={form.category_id || "none"} onValueChange={(v) => setForm((f) => ({ ...f, category_id: v === "none" ? "" : v }))}>
                  <SelectTrigger><SelectValue placeholder="Choisir..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sans catégorie</SelectItem>
                    {categories?.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name_fr}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Photo (URL)</Label>
              <Input value={form.image_url} onChange={(e) => setForm((f) => ({ ...f, image_url: e.target.value }))} placeholder="https://..." />
              {form.image_url && (
                <img src={form.image_url} alt="preview" className="h-20 w-20 rounded-lg object-cover mt-1 border border-surface-600" />
              )}
            </div>
            <div className="space-y-1.5">
              <Label>Description (FR)</Label>
              <Textarea value={form.description_fr} onChange={(e) => setForm((f) => ({ ...f, description_fr: e.target.value }))} rows={2} placeholder="Description en français..." />
            </div>
            <div className="space-y-1.5">
              <Label>Description (EN)</Label>
              <Textarea value={form.description_en} onChange={(e) => setForm((f) => ({ ...f, description_en: e.target.value }))} rows={2} placeholder="Description in English..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowCreate(false); setEditing(null); setForm(emptyForm); }}>Annuler</Button>
            <Button
              onClick={() => saveMutation.mutate(form)}
              disabled={!form.name_fr || !form.name_en || !form.price || saveMutation.isPending}
            >
              {saveMutation.isPending ? "..." : editing ? "Enregistrer" : "Créer le produit"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal promo */}
      <Dialog open={!!promoTarget} onOpenChange={(v) => { if (!v) { setPromoTarget(null); setPromoForm({ promo_price: "", promo_ends_at: "" }); } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>
              <Tag className="inline h-4 w-4 mr-2 text-brand-400" />
              Promotion — {promoTarget?.name_fr}
            </DialogTitle>
            <DialogDescription>
              Prix normal : <strong>{promoTarget && formatCurrency(promoTarget.price)}</strong>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Prix promotionnel (FCFA) <span className="text-red-400">*</span></Label>
              <Input
                type="number"
                value={promoForm.promo_price}
                onChange={(e) => setPromoForm((f) => ({ ...f, promo_price: e.target.value }))}
                placeholder="Ex : 1500"
              />
              {promoTarget && promoForm.promo_price && Number(promoForm.promo_price) < promoTarget.price && (
                <p className="text-xs text-brand-400">
                  Réduction : -{Math.round((1 - Number(promoForm.promo_price) / promoTarget.price) * 100)}%
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>Date de fin <span className="text-slate-500 text-xs">(optionnel)</span></Label>
              <Input
                type="datetime-local"
                value={promoForm.promo_ends_at}
                onChange={(e) => setPromoForm((f) => ({ ...f, promo_ends_at: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPromoTarget(null)}>Annuler</Button>
            <Button
              onClick={() => promoMutation.mutate({
                id: promoTarget!.id,
                promo_price: Number(promoForm.promo_price),
                promo_ends_at: promoForm.promo_ends_at ? new Date(promoForm.promo_ends_at).toISOString() : null,
              })}
              disabled={!promoForm.promo_price || promoMutation.isPending}
            >
              {promoMutation.isPending ? "..." : "Appliquer la promo"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
