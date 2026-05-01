"use client";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, apiGet } from "@/lib/api";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Pagination } from "@/components/ui/pagination";
import { Wallet, TrendingUp, ArrowDownToLine, Building2, Megaphone, ArrowUpFromLine } from "lucide-react";

interface PlatformWallet {
  id: string; balance: number; total_received: number; updated_at: string;
}

interface PlatformTransaction {
  id: string; type: string; amount: number; description: string;
  created_at: string; campay_reference?: string;
  brands?: { name: string } | null;
}

const TX_TYPE: Record<string, { label: string; variant: any; sign: string }> = {
  commission: { label: "Commission", variant: "confirmed", sign: "+" },
  ad_payment: { label: "Pub",        variant: "pending",   sign: "+" },
  withdrawal: { label: "Retrait",    variant: "cancelled", sign: "−" },
};

export default function SuperadminWalletPage() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [wAmount, setWAmount] = useState("");
  const [wPhone, setWPhone]   = useState("");

  const { data: wallet, isLoading: walletLoading } = useQuery<PlatformWallet>({
    queryKey: ["platform-wallet"],
    queryFn: () => apiGet("/wallet/platform"),
  });

  const { data: txData, isLoading: txLoading } = useQuery<{ data: PlatformTransaction[]; pagination: any }>({
    queryKey: ["platform-wallet-transactions", page],
    queryFn: () => apiGet("/wallet/platform/transactions", { page, limit: 20 }) as any,
  });

  const withdrawMutation = useMutation({
    mutationFn: () => api.post("/wallet/platform/withdraw", { amount: Number(wAmount), phone: wPhone }),
    onSuccess: () => {
      toast.success("Retrait effectué avec succès");
      qc.invalidateQueries({ queryKey: ["platform-wallet"] });
      qc.invalidateQueries({ queryKey: ["platform-wallet-transactions"] });
      setWithdrawOpen(false); setWAmount(""); setWPhone("");
    },
    onError: (e: any) => toast.error(e?.response?.data?.error?.message ?? "Erreur lors du retrait"),
  });

  const transactions = txData?.data ?? [];
  const balance = wallet?.balance ?? 0;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Wallet className="h-6 w-6 text-brand-600" /> Wallet Plateforme
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Commissions et revenus publicitaires — retrait vers Orange / MTN
          </p>
        </div>
        <Button onClick={() => setWithdrawOpen(true)} className="gap-2" disabled={balance <= 0}>
          <ArrowUpFromLine className="h-4 w-4" /> Retirer
        </Button>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border-brand-100 bg-brand-50 sm:col-span-1">
          <CardContent className="p-6">
            {walletLoading ? <Skeleton className="h-16 w-full" /> : (
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Solde disponible</p>
                <p className="text-3xl font-black text-brand-700">{formatCurrency(balance)}</p>
                <p className="text-xs text-slate-500 mt-1">Mis à jour {wallet ? formatDateTime(wallet.updated_at) : "—"}</p>
              </div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            {walletLoading ? <Skeleton className="h-16 w-full" /> : (
              <div className="flex items-start gap-3">
                <div className="h-10 w-10 rounded-lg bg-green-50 flex items-center justify-center shrink-0">
                  <TrendingUp className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Total reçu</p>
                  <p className="text-xl font-bold text-slate-900">{formatCurrency(wallet?.total_received ?? 0)}</p>
                  <p className="text-xs text-slate-500">Commissions + publicités</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-start gap-3">
              <div className="h-10 w-10 rounded-lg bg-orange-50 flex items-center justify-center shrink-0">
                <Megaphone className="h-5 w-5 text-orange-600" />
              </div>
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Sources</p>
                <p className="text-sm font-semibold text-slate-900">Commissions agences</p>
                <p className="text-sm font-semibold text-slate-900">Paiements publicités</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Historique */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <ArrowDownToLine className="h-4 w-4 text-brand-600" />
            Historique des transactions
          </CardTitle>
        </CardHeader>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Marque / Description</TableHead>
              <TableHead className="text-right">Montant</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {txLoading
              ? Array.from({ length: 8 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 4 }).map((_, j) => (
                      <TableCell key={j}><Skeleton className="h-5 w-full" /></TableCell>
                    ))}
                  </TableRow>
                ))
              : transactions.length === 0
                ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-slate-500 py-10">
                      Aucune transaction pour le moment
                    </TableCell>
                  </TableRow>
                )
                : transactions.map((tx) => {
                  const meta = TX_TYPE[tx.type] ?? { label: tx.type, variant: "default", sign: "+" };
                  return (
                    <TableRow key={tx.id}>
                      <TableCell className="text-sm text-slate-500 whitespace-nowrap">
                        {formatDateTime(tx.created_at)}
                      </TableCell>
                      <TableCell>
                        <Badge variant={meta.variant}>{meta.label}</Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {tx.brands?.name && <><Building2 className="h-4 w-4 text-slate-400 shrink-0" /><span className="text-sm font-medium text-slate-900">{tx.brands.name} — </span></>}
                          <span className="text-sm text-slate-500 truncate max-w-xs">{tx.description}</span>
                        </div>
                      </TableCell>
                      <TableCell className={`text-right font-bold tabular-nums ${tx.type === "withdrawal" ? "text-red-600" : "text-green-600"}`}>
                        {meta.sign}{formatCurrency(tx.amount)}
                      </TableCell>
                    </TableRow>
                  );
                })
            }
          </TableBody>
        </Table>
        {txData?.pagination && (
          <div className="p-4 border-t border-slate-200">
            <Pagination page={txData.pagination.page} totalPages={txData.pagination.total_pages}
              total={txData.pagination.total} limit={txData.pagination.limit} onPageChange={setPage} />
          </div>
        )}
      </Card>

      {/* Modale retrait */}
      <Dialog open={withdrawOpen} onOpenChange={setWithdrawOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Retrait vers Mobile Money</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="rounded-xl bg-brand-50 border border-brand-100 p-4">
              <p className="text-xs text-slate-500">Solde disponible</p>
              <p className="text-2xl font-black text-brand-700">{formatCurrency(balance)}</p>
            </div>
            <div className="space-y-1.5">
              <Label>Montant à retirer (FCFA)</Label>
              <Input type="number" min={100} step={100} value={wAmount}
                onChange={(e) => setWAmount(e.target.value)} placeholder="Ex: 5000" />
            </div>
            <div className="space-y-1.5">
              <Label>Numéro Orange / MTN</Label>
              <Input value={wPhone} onChange={(e) => setWPhone(e.target.value)}
                placeholder="+237 6XX XXX XXX" type="tel" />
            </div>
            <p className="text-xs text-slate-400">
              Le virement sera effectué via Campay. Le solde sera débité immédiatement.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setWithdrawOpen(false)}>Annuler</Button>
            <Button
              disabled={!wAmount || Number(wAmount) <= 0 || !wPhone.trim() || Number(wAmount) > balance || withdrawMutation.isPending}
              onClick={() => withdrawMutation.mutate()}>
              {withdrawMutation.isPending ? <><Spinner size="sm" /> En cours…</> : "Confirmer le retrait"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
