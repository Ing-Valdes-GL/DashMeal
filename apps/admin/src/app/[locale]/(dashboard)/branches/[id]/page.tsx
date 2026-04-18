"use client";
import { useState, use, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { apiGet, apiPost, apiPatch, apiDelete, apiUpload } from "@/lib/api";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  ArrowLeft, Plus, MoreHorizontal, Pencil, Trash2,
  Eye, EyeOff, Tag, Package, MapPin, RefreshCw,
  Upload, ShoppingCart, BarChart2, TrendingUp, Clock,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Branch { id: string; name: string; address: string; city: string; phone: string | null; is_active: boolean }
interface Product {
  id: string; name_fr: string; name_en: string; price: number;
  image_url: string | null; is_active: boolean; is_hidden: boolean;
  promo_price: number | null; promo_ends_at: string | null;
  category_id: string | null; categories?: { name_fr: string };
  description_fr?: string; description_en?: string;
}
interface Category { id: string; name_fr: string; name_en: string; icon: string | null; branch_id: string | null }
interface Order {
  id: string; total: number; status: string; type: string; created_at: string;
  users?: { name: string; phone: string };
  order_items?: { quantity: number; unit_price: number; products?: { name_fr: string } }[];
}
interface BranchStats {
  total_orders: number; pending_orders: number; today_orders: number;
  total_revenue: number; by_status: Record<string, number>;
}

const STATUS_LABELS: Record<string, string> = {
  pending: "En attente", confirmed: "Confirmée", preparing: "En préparation",
  ready: "Prête", delivering: "En livraison", delivered: "Livrée", cancelled: "Annulée",
};
const STATUS_NEXT: Record<string, string[]> = {
  pending: ["confirmed", "cancelled"],
  confirmed: ["preparing", "cancelled"],
  preparing: ["ready", "cancelled"],
  ready: ["delivering", "delivered"],
  delivering: ["delivered"],
};
const STATUS_VARIANT: Record<string, any> = {
  pending: "pending", confirmed: "confirmed", preparing: "preparing",
  ready: "ready", delivering: "delivering", delivered: "delivered", cancelled: "cancelled",
};

const emptyForm = { name_fr: "", name_en: "", price: "", description_fr: "", description_en: "", image_url: "", category_id: "" };

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function BranchDetailPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id: branchId } = use(params);
  const router = useRouter();
  const qc = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Produits
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [promoTarget, setPromoTarget] = useState<Product | null>(null);
  const [promoForm, setPromoForm] = useState({ promo_price: "", promo_ends_at: "" });
  const [form, setForm] = useState(emptyForm);
  const [uploading, setUploading] = useState(false);

  // Catégories
  const [showCatDialog, setShowCatDialog] = useState(false);
  const [catForm, setCatForm] = useState({ name_fr: "", name_en: "", icon: "" });

  // Commandes
  const [orderStatus, setOrderStatus] = useState("all");
  const [statusTarget, setStatusTarget] = useState<Order | null>(null);
  const [nextStatus, setNextStatus] = useState("");

  // ─── Requêtes ──────────────────────────────────────────────────────────────

  const { data: branch, isLoading: branchLoading } = useQuery<Branch>({
    queryKey: ["branch", branchId],
    queryFn: () => apiGet<Branch>(`/branches/${branchId}`),
  });

  const { data: products, isLoading: productsLoading, refetch: refetchProducts } = useQuery<Product[]>({
    queryKey: ["branch-products", branchId],
    queryFn: () => apiGet<Product[]>(`/products/branch/${branchId}`),
  });

  const { data: categories, refetch: refetchCategories } = useQuery<Category[]>({
    queryKey: ["branch-categories", branchId],
    queryFn: () => apiGet<Category[]>(`/products/categories?branch_id=${branchId}`),
  });

  const { data: ordersData, refetch: refetchOrders } = useQuery<{ data: Order[]; pagination: any }>({
    queryKey: ["branch-orders", branchId, orderStatus],
    queryFn: () => apiGet<{ data: Order[]; pagination: any }>("/orders", {
      branch_id: branchId,
      limit: 50,
      ...(orderStatus !== "all" && { status: orderStatus }),
    }) as any,
  });
  const orders = (ordersData as any)?.data ?? (Array.isArray(ordersData) ? ordersData : []);

  const { data: stats } = useQuery<BranchStats>({
    queryKey: ["branch-stats", branchId],
    queryFn: () => apiGet<BranchStats>(`/analytics/branch/${branchId}`),
  });

  // ─── Mutations produits ────────────────────────────────────────────────────

  const saveMutation = useMutation({
    mutationFn: (d: typeof form) => {
      const payload = {
        branch_id: branchId,
        name_fr: d.name_fr, name_en: d.name_en,
        price: Number(d.price),
        ...(d.description_fr && { description_fr: d.description_fr }),
        ...(d.description_en && { description_en: d.description_en }),
        ...(d.image_url && { image_url: d.image_url }),
        ...(d.category_id && { category_id: d.category_id }),
      };
      return editing ? apiPatch(`/products/${editing.id}`, payload) : apiPost("/products", payload);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["branch-products", branchId] });
      toast.success(editing ? "Produit modifié" : "Produit créé");
      setShowCreate(false); setEditing(null); setForm(emptyForm);
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
    onSuccess: (_, v) => {
      qc.invalidateQueries({ queryKey: ["branch-products", branchId] });
      toast.success(v.promo_price ? "Promo activée" : "Promo retirée");
      setPromoTarget(null); setPromoForm({ promo_price: "", promo_ends_at: "" });
    },
    onError: () => toast.error("Erreur"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiDelete(`/products/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["branch-products", branchId] }); toast.success("Produit supprimé"); },
    onError: () => toast.error("Erreur"),
  });

  // ─── Mutations catégories ──────────────────────────────────────────────────

  const createCatMutation = useMutation({
    mutationFn: () => apiPost("/products/categories", {
      name_fr: catForm.name_fr, name_en: catForm.name_en || catForm.name_fr,
      icon: catForm.icon || undefined, branch_id: branchId,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["branch-categories", branchId] });
      toast.success("Catégorie ajoutée");
      setShowCatDialog(false); setCatForm({ name_fr: "", name_en: "", icon: "" });
    },
    onError: () => toast.error("Erreur"),
  });

  const deleteCatMutation = useMutation({
    mutationFn: (id: string) => apiDelete(`/products/categories/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["branch-categories", branchId] }),
    onError: () => toast.error("Erreur"),
  });

  // ─── Mutation commandes ────────────────────────────────────────────────────

  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      apiPatch(`/orders/${id}/status`, { status }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["branch-orders", branchId] });
      qc.invalidateQueries({ queryKey: ["branch-stats", branchId] });
      toast.success("Statut mis à jour");
      setStatusTarget(null);
    },
    onError: () => toast.error("Erreur"),
  });

  // ─── Upload image ──────────────────────────────────────────────────────────

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const result = await apiUpload<{ url: string }>("/products/upload-image", file);
      setForm((f) => ({ ...f, image_url: result.url }));
      toast.success("Photo uploadée");
    } catch {
      toast.error("Échec de l'upload");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // ─── Helpers ───────────────────────────────────────────────────────────────

  const openEdit = (p: Product) => {
    setEditing(p);
    setForm({ name_fr: p.name_fr, name_en: p.name_en, price: String(p.price),
      description_fr: p.description_fr ?? "", description_en: p.description_en ?? "",
      image_url: p.image_url ?? "", category_id: p.category_id ?? "" });
    setShowCreate(true);
  };

  const productsList = products ?? [];
  const activeCount = productsList.filter((p) => !p.is_hidden).length;
  const promoCount = productsList.filter((p) => p.promo_price !== null).length;

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => router.push(`/${locale}/branches`)}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            {branchLoading ? <Skeleton className="h-7 w-48" /> : (
              <>
                <h1 className="text-2xl font-bold text-slate-900">{branch?.name}</h1>
                <p className="text-sm text-slate-400 flex items-center gap-1">
                  <MapPin className="h-3 w-3" />{branch?.address}, {branch?.city}
                </p>
              </>
            )}
          </div>
        </div>
        <Button variant="ghost" size="sm" onClick={() => { refetchProducts(); refetchOrders(); }}>
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      {/* KPIs rapides */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card><CardContent className="p-4 text-center">
          <p className="text-2xl font-bold text-slate-900">{productsList.length}</p>
          <p className="text-xs text-slate-500 mt-1">Produits</p>
        </CardContent></Card>
        <Card><CardContent className="p-4 text-center">
          <p className="text-2xl font-bold text-green-400">{activeCount}</p>
          <p className="text-xs text-slate-500 mt-1">Visibles</p>
        </CardContent></Card>
        <Card><CardContent className="p-4 text-center">
          <p className="text-2xl font-bold text-brand-400">{stats?.today_orders ?? 0}</p>
          <p className="text-xs text-slate-500 mt-1">Cdes aujourd'hui</p>
        </CardContent></Card>
        <Card><CardContent className="p-4 text-center">
          <p className="text-2xl font-bold text-slate-900">{formatCurrency(stats?.total_revenue ?? 0)}</p>
          <p className="text-xs text-slate-500 mt-1">CA total</p>
        </CardContent></Card>
      </div>

      {/* Onglets */}
      <Tabs defaultValue="products">
        <TabsList>
          <TabsTrigger value="products"><Package className="h-3.5 w-3.5 mr-1.5" />Produits</TabsTrigger>
          <TabsTrigger value="orders"><ShoppingCart className="h-3.5 w-3.5 mr-1.5" />Commandes</TabsTrigger>
          <TabsTrigger value="analytics"><BarChart2 className="h-3.5 w-3.5 mr-1.5" />Analytiques</TabsTrigger>
        </TabsList>

        {/* ── Onglet Produits ─────────────────────────────────────────────── */}
        <TabsContent value="products" className="space-y-4 mt-4">
          {/* Catégories */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Catégories</CardTitle>
                <Button size="sm" onClick={() => setShowCatDialog(true)}><Plus className="h-4 w-4" />Ajouter</Button>
              </div>
            </CardHeader>
            <CardContent>
              {(categories ?? []).length === 0 ? (
                <p className="text-sm text-slate-500 text-center py-2">Aucune catégorie</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {(categories ?? []).map((c) => (
                    <div key={c.id} className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-full px-3 py-1.5">
                      {c.icon && <span className="text-sm">{c.icon}</span>}
                      <span className="text-sm text-slate-200">{c.name_fr}</span>
                      {c.branch_id && (
                        <button onClick={() => { if (confirm(`Supprimer "${c.name_fr}" ?`)) deleteCatMutation.mutate(c.id); }}
                          className="ml-1 text-slate-500 hover:text-red-400 transition-colors">×</button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Table produits */}
          <div className="flex justify-end">
            <Button onClick={() => { setEditing(null); setForm(emptyForm); setShowCreate(true); }}>
              <Plus className="h-4 w-4" />Nouveau produit
            </Button>
          </div>
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
                  ? Array.from({ length: 5 }).map((_, i) => (
                      <TableRow key={i}>{Array.from({ length: 6 }).map((_, j) => (
                        <TableCell key={j}><Skeleton className="h-5 w-full" /></TableCell>
                      ))}</TableRow>
                    ))
                  : productsList.map((p) => (
                      <TableRow key={p.id} className={p.is_hidden ? "opacity-50" : ""}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-lg bg-slate-50 flex items-center justify-center overflow-hidden shrink-0">
                              {p.image_url
                                ? <img src={p.image_url} alt={p.name_fr} className="h-full w-full object-cover" />
                                : <Package className="h-5 w-5 text-slate-600" />}
                            </div>
                            <div>
                              <p className="font-medium text-slate-900">{p.name_fr}</p>
                              <p className="text-xs text-slate-500">{p.name_en}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-slate-400 text-sm">{p.categories?.name_fr ?? "—"}</TableCell>
                        <TableCell>
                          <p className={`font-semibold ${p.promo_price ? "line-through text-slate-500 text-sm" : "text-slate-900"}`}>{formatCurrency(p.price)}</p>
                          {p.promo_price && <p className="text-brand-400 font-bold text-sm">{formatCurrency(p.promo_price)}</p>}
                        </TableCell>
                        <TableCell>
                          {p.promo_price
                            ? <Badge variant="pending" className="text-xs"><Tag className="h-3 w-3 mr-1" />-{Math.round((1 - p.promo_price / p.price) * 100)}%</Badge>
                            : <span className="text-xs text-slate-600">—</span>}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Switch checked={!p.is_hidden} onCheckedChange={() => toggleHiddenMutation.mutate(p.id)} />
                            <span className="text-xs text-slate-500">{p.is_hidden ? "Masqué" : "Visible"}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon-sm"><MoreHorizontal className="h-4 w-4" /></Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => openEdit(p)}><Pencil className="mr-2 h-4 w-4" />Modifier</DropdownMenuItem>
                              <DropdownMenuItem onClick={() => { setPromoTarget(p); setPromoForm({ promo_price: p.promo_price ? String(p.promo_price) : "", promo_ends_at: p.promo_ends_at?.slice(0, 16) ?? "" }); }}>
                                <Tag className="mr-2 h-4 w-4 text-brand-400" />{p.promo_price ? "Modifier la promo" : "Ajouter une promo"}
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => toggleHiddenMutation.mutate(p.id)}>
                                {p.is_hidden ? <><Eye className="mr-2 h-4 w-4" />Rendre visible</> : <><EyeOff className="mr-2 h-4 w-4" />Masquer</>}
                              </DropdownMenuItem>
                              {p.promo_price && (
                                <DropdownMenuItem onClick={() => promoMutation.mutate({ id: p.id, promo_price: null, promo_ends_at: null })}>
                                  <Tag className="mr-2 h-4 w-4 text-red-400" />Retirer la promo
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuItem destructive onClick={() => { if (confirm("Supprimer ce produit ?")) deleteMutation.mutate(p.id); }}>
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
              </div>
            )}
          </Card>
        </TabsContent>

        {/* ── Onglet Commandes ────────────────────────────────────────────── */}
        <TabsContent value="orders" className="space-y-4 mt-4">
          {/* Filtre statut */}
          <div className="flex items-center gap-2 flex-wrap">
            {["all", "pending", "confirmed", "preparing", "ready", "delivering", "delivered", "cancelled"].map((s) => (
              <button
                key={s}
                onClick={() => setOrderStatus(s)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${orderStatus === s ? "bg-brand-500 text-slate-900" : "bg-slate-50 text-slate-400 hover:text-slate-900"}`}
              >
                {s === "all" ? "Tout" : STATUS_LABELS[s]}
              </button>
            ))}
          </div>

          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>N°</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Articles</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {orders.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-slate-500 py-10">
                      <ShoppingCart className="h-8 w-8 mx-auto mb-2 text-slate-700" />
                      Aucune commande
                    </TableCell>
                  </TableRow>
                ) : orders.map((o: Order) => (
                  <TableRow key={o.id}>
                    <TableCell className="font-mono text-xs text-slate-500">#{o.id.slice(0, 8)}</TableCell>
                    <TableCell>
                      <p className="text-slate-900 text-sm">{o.users?.name ?? "—"}</p>
                      <p className="text-xs text-slate-500">{o.users?.phone ?? ""}</p>
                    </TableCell>
                    <TableCell className="text-slate-400 text-sm">
                      {o.order_items?.length ?? 0} article(s)
                    </TableCell>
                    <TableCell className="font-semibold text-slate-900">{formatCurrency(o.total)}</TableCell>
                    <TableCell>
                      <Badge variant={STATUS_VARIANT[o.status] ?? "inactive"} className="text-xs">
                        {STATUS_LABELS[o.status] ?? o.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-slate-500">{formatDateTime(o.created_at)}</TableCell>
                    <TableCell>
                      {STATUS_NEXT[o.status] && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon-sm"><MoreHorizontal className="h-4 w-4" /></Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {STATUS_NEXT[o.status]?.map((s) => (
                              <DropdownMenuItem key={s} onClick={() => updateStatusMutation.mutate({ id: o.id, status: s })}>
                                → {STATUS_LABELS[s]}
                              </DropdownMenuItem>
                            ))}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        {/* ── Onglet Analytiques ──────────────────────────────────────────── */}
        <TabsContent value="analytics" className="space-y-4 mt-4">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Card><CardContent className="p-5">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-brand-500/10 flex items-center justify-center">
                  <TrendingUp className="h-5 w-5 text-brand-400" />
                </div>
                <div>
                  <p className="text-xs text-slate-500">CA total (livrées)</p>
                  <p className="text-lg font-bold text-slate-900">{formatCurrency(stats?.total_revenue ?? 0)}</p>
                </div>
              </div>
            </CardContent></Card>
            <Card><CardContent className="p-5">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-green-500/10 flex items-center justify-center">
                  <ShoppingCart className="h-5 w-5 text-green-400" />
                </div>
                <div>
                  <p className="text-xs text-slate-500">Commandes totales</p>
                  <p className="text-lg font-bold text-slate-900">{stats?.total_orders ?? 0}</p>
                </div>
              </div>
            </CardContent></Card>
            <Card><CardContent className="p-5">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
                  <Clock className="h-5 w-5 text-blue-400" />
                </div>
                <div>
                  <p className="text-xs text-slate-500">Aujourd'hui</p>
                  <p className="text-lg font-bold text-slate-900">{stats?.today_orders ?? 0}</p>
                </div>
              </div>
            </CardContent></Card>
            <Card><CardContent className="p-5">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-yellow-500/10 flex items-center justify-center">
                  <Clock className="h-5 w-5 text-yellow-400" />
                </div>
                <div>
                  <p className="text-xs text-slate-500">En attente</p>
                  <p className="text-lg font-bold text-slate-900">{stats?.pending_orders ?? 0}</p>
                </div>
              </div>
            </CardContent></Card>
          </div>

          {/* Répartition par statut */}
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-base">Répartition des commandes</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-3">
                {Object.entries(stats?.by_status ?? {}).map(([s, count]) => {
                  const total = stats?.total_orders ?? 1;
                  const pct = Math.round((count / total) * 100);
                  return (
                    <div key={s}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm text-slate-700">{STATUS_LABELS[s] ?? s}</span>
                        <span className="text-sm font-semibold text-slate-900">{count} <span className="text-slate-500 font-normal">({pct}%)</span></span>
                      </div>
                      <div className="h-2 bg-slate-50 rounded-full overflow-hidden">
                        <div className="h-full bg-brand-500 rounded-full" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
                {Object.keys(stats?.by_status ?? {}).length === 0 && (
                  <p className="text-sm text-slate-500 text-center py-6">Aucune donnée disponible</p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ── Dialog nouvelle catégorie ─────────────────────────────────────── */}
      <Dialog open={showCatDialog} onOpenChange={setShowCatDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Nouvelle catégorie</DialogTitle>
            <DialogDescription>Catégorie spécifique à cette agence.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Nom (FR) <span className="text-red-400">*</span></Label>
              <Input value={catForm.name_fr} onChange={(e) => setCatForm((f) => ({ ...f, name_fr: e.target.value }))} placeholder="Ex : Boissons" />
            </div>
            <div className="space-y-1.5">
              <Label>Nom (EN)</Label>
              <Input value={catForm.name_en} onChange={(e) => setCatForm((f) => ({ ...f, name_en: e.target.value }))} placeholder="Ex : Beverages" />
            </div>
            <div className="space-y-1.5">
              <Label>Icône (emoji)</Label>
              <Input value={catForm.icon} onChange={(e) => setCatForm((f) => ({ ...f, icon: e.target.value }))} placeholder="Ex : 🥤" maxLength={4} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCatDialog(false)}>Annuler</Button>
            <Button onClick={() => createCatMutation.mutate()} disabled={!catForm.name_fr || createCatMutation.isPending}>
              {createCatMutation.isPending ? "..." : "Créer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Dialog créer/modifier produit ────────────────────────────────── */}
      <Dialog open={showCreate} onOpenChange={(v) => { setShowCreate(v); if (!v) { setEditing(null); setForm(emptyForm); } }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Modifier le produit" : "Nouveau produit"}</DialogTitle>
            {!editing && (
              <DialogDescription>Produit disponible uniquement dans <strong>{branch?.name}</strong>.</DialogDescription>
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
                      <SelectItem key={c.id} value={c.id}>{c.icon ? `${c.icon} ` : ""}{c.name_fr}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Upload photo */}
            <div className="space-y-1.5">
              <Label>Photo du produit <span className="text-red-400">*</span></Label>
              <div className="flex items-center gap-3">
                <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleFileChange} />
                <Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
                  <Upload className="h-4 w-4 mr-2" />
                  {uploading ? "Upload..." : "Choisir une photo"}
                </Button>
                {form.image_url && (
                  <Button type="button" variant="ghost" size="sm" className="text-red-400" onClick={() => setForm((f) => ({ ...f, image_url: "" }))}>
                    Retirer
                  </Button>
                )}
              </div>
              {form.image_url && (
                <img src={form.image_url} alt="preview" className="h-28 w-28 rounded-xl object-cover border border-slate-200 mt-2" />
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

      {/* ── Dialog promo ─────────────────────────────────────────────────── */}
      <Dialog open={!!promoTarget} onOpenChange={(v) => { if (!v) { setPromoTarget(null); setPromoForm({ promo_price: "", promo_ends_at: "" }); } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle><Tag className="inline h-4 w-4 mr-2 text-brand-400" />Promotion — {promoTarget?.name_fr}</DialogTitle>
            <DialogDescription>Prix normal : <strong>{promoTarget && formatCurrency(promoTarget.price)}</strong></DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Prix promotionnel (FCFA) <span className="text-red-400">*</span></Label>
              <Input type="number" value={promoForm.promo_price}
                onChange={(e) => setPromoForm((f) => ({ ...f, promo_price: e.target.value }))} placeholder="Ex : 1500" />
              {promoTarget && promoForm.promo_price && Number(promoForm.promo_price) < promoTarget.price && (
                <p className="text-xs text-brand-400">Réduction : -{Math.round((1 - Number(promoForm.promo_price) / promoTarget.price) * 100)}%</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>Date de fin <span className="text-slate-500 text-xs">(optionnel)</span></Label>
              <Input type="datetime-local" value={promoForm.promo_ends_at}
                onChange={(e) => setPromoForm((f) => ({ ...f, promo_ends_at: e.target.value }))} />
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
