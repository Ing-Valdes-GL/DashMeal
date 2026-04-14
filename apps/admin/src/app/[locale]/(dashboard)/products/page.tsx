"use client";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { apiGet, apiPost, apiPatch, apiDelete } from "@/lib/api";
import { formatCurrency } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Pagination } from "@/components/ui/pagination";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Plus, Search, MoreHorizontal, Pencil, Trash2, ToggleLeft, ToggleRight, Package } from "lucide-react";

interface Product {
  id: string; name_fr: string; name_en: string; price: number;
  is_active: boolean; category_id: string | null;
  categories?: { name_fr: string };
  product_images?: { url: string; is_primary: boolean }[];
}
interface Category { id: string; name_fr: string; name_en: string }

const ProductSchema = z.object({
  name_fr: z.string().min(1),
  name_en: z.string().min(1),
  description_fr: z.string().optional(),
  description_en: z.string().optional(),
  price: z.coerce.number().min(0),
  category_id: z.string().optional(),
});
type ProductForm = z.infer<typeof ProductSchema>;

export default function ProductsPage() {
  const t = useTranslations("products");
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);

  const { data, isLoading } = useQuery<{ data: Product[]; pagination: any }>({
    queryKey: ["products", { page, search, categoryFilter }],
    queryFn: () => apiGet("/products", {
      page, limit: 20,
      ...(search && { q: search }),
      ...(categoryFilter !== "all" && { category_id: categoryFilter }),
    }) as any,
  });

  const { data: categories } = useQuery<Category[]>({
    queryKey: ["categories"],
    queryFn: () => apiGet("/products/categories"),
  });

  const { register, handleSubmit, reset, setValue, formState: { errors, isSubmitting } } = useForm<ProductForm>({
    resolver: zodResolver(ProductSchema),
  });

  const createMutation = useMutation({
    mutationFn: (d: ProductForm) => editing
      ? apiPatch(`/products/${editing.id}`, d)
      : apiPost("/products", d),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["products"] });
      toast.success(editing ? "Produit modifié" : "Produit créé");
      setShowModal(false);
      reset();
      setEditing(null);
    },
    onError: () => toast.error("Erreur", "Impossible de sauvegarder le produit"),
  });

  const toggleMutation = useMutation({
    mutationFn: (p: Product) => apiPatch(`/products/${p.id}`, { is_active: !p.is_active }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["products"] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiDelete(`/products/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["products"] }); toast.success("Produit supprimé"); },
    onError: () => toast.error("Erreur"),
  });

  const openCreate = () => { reset(); setEditing(null); setShowModal(true); };
  const openEdit = (p: Product) => {
    setEditing(p);
    setValue("name_fr", p.name_fr);
    setValue("name_en", p.name_en);
    setValue("price", p.price);
    if (p.category_id) setValue("category_id", p.category_id);
    setShowModal(true);
  };

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">{t("title")}</h1>
          <p className="text-sm text-slate-400">{t("subtitle")}</p>
        </div>
        <Button onClick={openCreate}><Plus className="h-4 w-4" />{t("addProduct")}</Button>
      </div>

      <Card>
        <CardContent className="p-4 flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
            <Input placeholder={t("name") + "..."} value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }} className="pl-9" />
          </div>
          <Select value={categoryFilter} onValueChange={(v) => { setCategoryFilter(v); setPage(1); }}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder={t("category")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toutes catégories</SelectItem>
              {categories?.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.name_fr}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Produit</TableHead>
              <TableHead>{t("category")}</TableHead>
              <TableHead>{t("price")}</TableHead>
              <TableHead>{t("stock")}</TableHead>
              <TableHead>Statut</TableHead>
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
              : (data?.data ?? []).map((p) => (
                  <TableRow key={p.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-lg bg-surface-700 flex items-center justify-center overflow-hidden">
                          {p.product_images?.[0] ? (
                            <img src={p.product_images[0].url} alt={p.name_fr} className="h-full w-full object-cover" />
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
                    <TableCell className="text-slate-400">{p.categories?.name_fr ?? "—"}</TableCell>
                    <TableCell className="font-semibold text-white">{formatCurrency(p.price)}</TableCell>
                    <TableCell><span className="text-xs text-slate-500">—</span></TableCell>
                    <TableCell>
                      <Badge variant={p.is_active ? "active" : "inactive"}>
                        {p.is_active ? "Actif" : "Inactif"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon-sm"><MoreHorizontal className="h-4 w-4" /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openEdit(p)}>
                            <Pencil className="mr-2 h-4 w-4" />{t("edit")}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => toggleMutation.mutate(p)}>
                            {p.is_active
                              ? <><ToggleLeft className="mr-2 h-4 w-4" />{t("deactivate")}</>
                              : <><ToggleRight className="mr-2 h-4 w-4" />{t("activate")}</>
                            }
                          </DropdownMenuItem>
                          <DropdownMenuItem destructive onClick={() => {
                            if (confirm(t("deleteConfirm"))) deleteMutation.mutate(p.id);
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
        {data?.pagination && (
          <div className="p-4 border-t border-surface-700/50">
            <Pagination page={data.pagination.page} totalPages={data.pagination.total_pages}
              total={data.pagination.total} limit={data.pagination.limit} onPageChange={setPage} />
          </div>
        )}
      </Card>

      {/* Modal produit */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? t("edit") : t("addProduct")}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit((d) => createMutation.mutate(d))} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>{t("nameFr")}</Label>
                <Input {...register("name_fr")} placeholder="Nom en français" />
              </div>
              <div className="space-y-1.5">
                <Label>{t("nameEn")}</Label>
                <Input {...register("name_en")} placeholder="Name in English" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>{t("price")} (FCFA)</Label>
                <Input {...register("price")} type="number" placeholder="0" />
              </div>
              <div className="space-y-1.5">
                <Label>{t("category")}</Label>
                <Select onValueChange={(v) => setValue("category_id", v)}>
                  <SelectTrigger><SelectValue placeholder="Choisir..." /></SelectTrigger>
                  <SelectContent>
                    {categories?.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name_fr}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>{t("descriptionFr")}</Label>
              <Textarea {...register("description_fr")} placeholder="Description en français..." rows={2} />
            </div>
            <div className="space-y-1.5">
              <Label>{t("descriptionEn")}</Label>
              <Textarea {...register("description_en")} placeholder="Description in English..." rows={2} />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowModal(false)}>Annuler</Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "..." : editing ? t("save") : t("create")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
