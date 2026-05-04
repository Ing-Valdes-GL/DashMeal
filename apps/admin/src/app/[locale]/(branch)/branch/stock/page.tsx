"use client";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { branchApiGet, branchApiPatch, branchApiPost } from "@/lib/branch-api";
import { useBranchAuthStore } from "@/stores/branch-auth";
import { formatCurrency } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Search, AlertTriangle, History, RefreshCw, Package } from "lucide-react";

interface StockItem {
  id: string;
  product_id: string;
  stock_qty: number;
  products: { name_fr: string; price: number; image_url: string | null };
}

interface StockMovement {
  id: string;
  product_id: string;
  type: "restock" | "adjustment" | "sale" | "removal" | "loss";
  qty_before: number;
  qty_after: number;
  delta: number;
  note: string | null;
  created_at: string;
  products: { name_fr: string };
}

const MOVEMENT_LABELS: Record<string, string> = {
  restock:    "Réapprovisionnement",
  adjustment: "Ajustement",
  sale:       "Vente",
  removal:    "Retrait",
  loss:       "Perte",
};

const MOVEMENT_COLORS: Record<string, string> = {
  restock:    "bg-green-100 text-green-800",
  adjustment: "bg-blue-100 text-blue-800",
  sale:       "bg-slate-100 text-slate-800",
  removal:    "bg-orange-100 text-orange-800",
  loss:       "bg-red-100 text-red-800",
};

function MovementRow({ m }: { m: StockMovement }) {
  const positive = m.delta > 0;
  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-slate-100 last:border-0">
      <Badge className={`text-[10px] shrink-0 ${MOVEMENT_COLORS[m.type] ?? "bg-slate-100"}`}>
        {MOVEMENT_LABELS[m.type] ?? m.type}
      </Badge>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-slate-800 truncate">{m.products?.name_fr}</p>
        {m.note && <p className="text-[11px] text-slate-400 truncate">{m.note}</p>}
      </div>
      <div className="text-right shrink-0">
        <p className={`text-sm font-bold ${positive ? "text-green-600" : "text-red-600"}`}>
          {positive ? "+" : ""}{m.delta}
        </p>
        <p className="text-[10px] text-slate-400">{m.qty_before} → {m.qty_after}</p>
      </div>
    </div>
  );
}

export default function BranchStockPage() {
  const { manager } = useBranchAuthStore();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [editItem, setEditItem] = useState<StockItem | null>(null);
  const [newQty, setNewQty] = useState("");
  const [note, setNote] = useState("");
  const [bulkEdits, setBulkEdits] = useState<Record<string, string>>({});
  const [isBulkMode, setIsBulkMode] = useState(false);

  const branchId = manager?.branch_id;

  const { data: stock = [], isLoading: stockLoading } = useQuery<StockItem[]>({
    queryKey: ["branch-stock", branchId],
    queryFn:  () => branchApiGet(`/stock/${branchId}`),
    enabled:  !!branchId,
    select: (d: any) => Array.isArray(d) ? d : d?.data ?? [],
  });

  const { data: alerts = [] } = useQuery<StockItem[]>({
    queryKey: ["branch-stock-alerts", branchId],
    queryFn:  () => branchApiGet(`/stock/${branchId}/alerts`, { threshold: 5 }),
    enabled:  !!branchId,
    select: (d: any) => Array.isArray(d) ? d : d?.data ?? [],
  });

  const { data: movements = [], isLoading: movLoading } = useQuery<StockMovement[]>({
    queryKey: ["branch-stock-movements", branchId],
    queryFn:  () => branchApiGet(`/stock/${branchId}/movements`, { limit: 100 }),
    enabled:  !!branchId,
    select: (d: any) => Array.isArray(d) ? d : d?.data ?? [],
  });

  const updateMutation = useMutation({
    mutationFn: ({ productId, qty, n }: { productId: string; qty: number; n?: string }) =>
      branchApiPatch(`/stock/${branchId}/${productId}`, { stock_qty: qty, note: n }),
    onSuccess: () => {
      toast.success("Stock mis à jour");
      qc.invalidateQueries({ queryKey: ["branch-stock"] });
      qc.invalidateQueries({ queryKey: ["branch-stock-movements"] });
      setEditItem(null);
      setNewQty("");
      setNote("");
    },
    onError: () => toast.error("Mise à jour échouée"),
  });

  const bulkMutation = useMutation({
    mutationFn: (items: { product_id: string; stock_qty: number }[]) =>
      branchApiPost(`/stock/${branchId}/bulk`, { items }),
    onSuccess: () => {
      toast.success("Stock mis à jour en masse");
      qc.invalidateQueries({ queryKey: ["branch-stock"] });
      qc.invalidateQueries({ queryKey: ["branch-stock-movements"] });
      setBulkEdits({});
      setIsBulkMode(false);
    },
    onError: () => toast.error("Mise à jour échouée"),
  });

  const filtered = stock.filter((s) =>
    !search || s.products?.name_fr?.toLowerCase().includes(search.toLowerCase())
  );

  const handleBulkSave = () => {
    const items = Object.entries(bulkEdits)
      .filter(([, v]) => v !== "" && !isNaN(parseInt(v)))
      .map(([productId, qty]) => ({ product_id: productId, stock_qty: parseInt(qty) }));
    if (items.length === 0) { toast.error("Aucune modification"); return; }
    bulkMutation.mutate(items);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Stock</h1>
          <p className="text-sm text-slate-500 mt-0.5">Gestion des quantités et alertes</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={isBulkMode ? "default" : "outline"}
            size="sm"
            onClick={() => { setIsBulkMode(!isBulkMode); setBulkEdits({}); }}
            className={isBulkMode ? "bg-brand-600 hover:bg-brand-700" : ""}
          >
            <RefreshCw className="h-4 w-4 mr-1.5" />
            {isBulkMode ? "Annuler masse" : "Mise à jour masse"}
          </Button>
          {isBulkMode && (
            <Button size="sm" className="bg-green-600 hover:bg-green-700" onClick={handleBulkSave} disabled={bulkMutation.isPending}>
              {bulkMutation.isPending ? "Sauvegarde..." : "Sauvegarder tout"}
            </Button>
          )}
        </div>
      </div>

      {/* Alerts banner */}
      {alerts.length > 0 && (
        <div className="flex items-center gap-3 rounded-xl bg-red-50 border border-red-200 px-4 py-3">
          <AlertTriangle className="h-5 w-5 text-red-500 shrink-0" />
          <p className="text-sm text-red-700 font-medium">
            {alerts.length} produit{alerts.length > 1 ? "s" : ""} en rupture ou stock faible
          </p>
        </div>
      )}

      <Tabs defaultValue="stock">
        <TabsList>
          <TabsTrigger value="stock" className="gap-1.5"><Package className="h-3.5 w-3.5" />Stock</TabsTrigger>
          <TabsTrigger value="history" className="gap-1.5"><History className="h-3.5 w-3.5" />Historique</TabsTrigger>
        </TabsList>

        {/* Stock tab */}
        <TabsContent value="stock" className="mt-4">
          <div className="relative mb-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Chercher un produit..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>

          <Card>
            <CardContent className="p-0">
              {stockLoading ? (
                <div className="p-4 space-y-3">
                  {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
                </div>
              ) : filtered.length === 0 ? (
                <p className="text-sm text-slate-400 text-center py-8">Aucun produit trouvé</p>
              ) : (
                <div className="divide-y divide-slate-100">
                  {filtered.map((item) => {
                    const low = item.stock_qty <= 5;
                    const zero = item.stock_qty === 0;
                    return (
                      <div key={item.id} className="flex items-center gap-4 px-4 py-3">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-slate-800 truncate">{item.products?.name_fr}</p>
                          <p className="text-xs text-slate-400">{formatCurrency(item.products?.price ?? 0)}</p>
                        </div>
                        {isBulkMode ? (
                          <Input
                            type="number"
                            min={0}
                            placeholder={String(item.stock_qty)}
                            value={bulkEdits[item.product_id] ?? ""}
                            onChange={(e) => setBulkEdits((prev) => ({ ...prev, [item.product_id]: e.target.value }))}
                            className="w-24 text-right"
                          />
                        ) : (
                          <>
                            <div className="text-right">
                              <span className={`text-sm font-bold ${zero ? "text-red-600" : low ? "text-yellow-600" : "text-slate-800"}`}>
                                {item.stock_qty}
                              </span>
                              {zero && <p className="text-[10px] text-red-500">Rupture</p>}
                              {!zero && low && <p className="text-[10px] text-yellow-500">Stock faible</p>}
                            </div>
                            <Button size="sm" variant="outline" onClick={() => { setEditItem(item); setNewQty(String(item.stock_qty)); }}>
                              Modifier
                            </Button>
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* History tab */}
        <TabsContent value="history" className="mt-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-slate-700">Mouvements de stock</CardTitle>
            </CardHeader>
            <CardContent className="p-0 px-4">
              {movLoading ? (
                <div className="space-y-3 py-2">
                  {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
                </div>
              ) : movements.length === 0 ? (
                <p className="text-sm text-slate-400 text-center py-8">Aucun mouvement enregistré</p>
              ) : (
                movements.map((m) => <MovementRow key={m.id} m={m} />)
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Edit single item dialog */}
      <Dialog open={!!editItem} onOpenChange={(o) => !o && setEditItem(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Modifier le stock</DialogTitle>
          </DialogHeader>
          {editItem && (
            <div className="space-y-4">
              <div className="rounded-lg bg-slate-50 p-3">
                <p className="text-sm font-semibold text-slate-800">{editItem.products?.name_fr}</p>
                <p className="text-xs text-slate-500 mt-0.5">Quantité actuelle : <strong>{editItem.stock_qty}</strong></p>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-600">Nouvelle quantité</label>
                <Input
                  type="number"
                  min={0}
                  value={newQty}
                  onChange={(e) => setNewQty(e.target.value)}
                  placeholder="Ex: 50"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-600">Note (optionnel)</label>
                <Input
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Raison de la modification..."
                />
              </div>
              <Button
                className="w-full bg-brand-600 hover:bg-brand-700"
                disabled={updateMutation.isPending || newQty === ""}
                onClick={() => updateMutation.mutate({ productId: editItem.product_id, qty: parseInt(newQty), n: note || undefined })}
              >
                {updateMutation.isPending ? "Sauvegarde..." : "Sauvegarder"}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
