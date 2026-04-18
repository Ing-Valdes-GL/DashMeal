"use client";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPost } from "@/lib/api";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Pagination } from "@/components/ui/pagination";
import {
  Wallet, TrendingUp, TrendingDown, ArrowDownToLine,
  RefreshCw, Plus, Minus, AlertCircle, Store,
} from "lucide-react";

interface BranchWallet {
  wallet_id:       string;
  branch_id:       string;
  branch_name:     string;
  balance:         number;
  total_credited:  number;
  total_withdrawn: number;
  updated_at:      string;
}

interface WalletSummary {
  total_balance:   number;
  total_credited:  number;
  total_withdrawn: number;
  branches:        BranchWallet[];
}

interface Transaction {
  id:               string;
  type:             "credit" | "withdrawal";
  branch_id:        string;
  amount:           number;
  balance_after:    number;
  description:      string;
  platform_fee:     number | null;
  net_payout:       number | null;
  campay_reference: string | null;
  status:           string;
  created_at:       string;
  branches?:        { name: string } | null;
  orders?:          { id: string } | null;
}

export default function WalletPage() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [typeFilter, setTypeFilter]     = useState("all");
  const [branchFilter, setBranchFilter] = useState("all");
  const [withdrawOpen, setWithdrawOpen]   = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [withdrawPhone, setWithdrawPhone]   = useState("");
  const [withdrawBranch, setWithdrawBranch] = useState("");

  const { data: walletData, isLoading: walletLoading } = useQuery<WalletSummary>({
    queryKey: ["wallet"],
    queryFn: () => apiGet("/wallet"),
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
  });

  const { data: txData, isLoading: txLoading } = useQuery<{ data: Transaction[]; pagination: any }>({
    queryKey: ["wallet-transactions", page, typeFilter, branchFilter],
    queryFn: () => apiGet("/wallet/transactions", {
      page, limit: 20,
      ...(typeFilter   !== "all" && { type:      typeFilter }),
      ...(branchFilter !== "all" && { branch_id: branchFilter }),
    }) as any,
  });

  const withdrawMutation = useMutation({
    mutationFn: (body: { amount: number; phone: string; branch_id: string }) =>
      apiPost("/wallet/withdraw", body),
    onSuccess: (res: any) => {
      qc.invalidateQueries({ queryKey: ["wallet"] });
      qc.invalidateQueries({ queryKey: ["wallet-transactions"] });
      toast.success(`Retrait effectué — ${formatCurrency(res.net_payout)} envoyés`);
      setWithdrawOpen(false);
      setWithdrawAmount("");
      setWithdrawPhone("");
      setWithdrawBranch("");
    },
    onError: (err: any) => {
      const msg  = err?.response?.data?.error?.message ?? "Erreur lors du retrait";
      const code = err?.response?.data?.error?.code ?? "";
      if (code === "AMOUNT_TOO_LOW" || code === "INSUFFICIENT_BALANCE") {
        toast.error(msg);
      } else if (code === "FORBIDDEN") {
        toast.error("Accès refusé — vérifiez que votre compte est bien de type 'admin'");
      } else {
        toast.error(msg);
      }
    },
  });

  const handleWithdraw = () => {
    const amount = parseFloat(withdrawAmount);
    const phone  = withdrawPhone.trim();
    if (!amount || amount <= 0) return toast.error("Montant invalide");
    if (!phone)                 return toast.error("Numéro de téléphone requis");
    if (!withdrawBranch)        return toast.error("Sélectionnez une agence");

    const selectedBranch = walletData?.branches.find((b) => b.branch_id === withdrawBranch);
    if (selectedBranch && amount > selectedBranch.balance)
      return toast.error(`Solde insuffisant pour ${selectedBranch.branch_name}`);

    const digits     = phone.replace(/\D/g, "");
    const normalized = digits.startsWith("237") ? digits : `237${digits}`;
    const prefix     = parseInt(normalized.slice(3, 6), 10);
    const isMTN      = (prefix >= 650 && prefix <= 654) || (prefix >= 658 && prefix <= 659)
                    || (prefix >= 670 && prefix <= 679) || (prefix >= 680 && prefix <= 687);
    const minAmount  = isMTN ? 100 : 10;
    if (amount < minAmount) {
      return toast.error(`Montant minimum pour ${isMTN ? "MTN" : "Orange"} Money : ${minAmount} FCFA`);
    }

    withdrawMutation.mutate({ amount, phone, branch_id: withdrawBranch });
  };

  const branches     = walletData?.branches ?? [];
  const transactions = txData?.data ?? [];

  const platformFeePreview = withdrawAmount ? Math.round(parseFloat(withdrawAmount) * 0.015) : 0;
  const netPayoutPreview   = withdrawAmount ? parseFloat(withdrawAmount) - platformFeePreview : 0;

  const selectedBranchBalance = withdrawBranch
    ? (branches.find((b) => b.branch_id === withdrawBranch)?.balance ?? 0)
    : 0;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Wallet className="h-6 w-6 text-brand-400" />
            Mon Wallet
          </h1>
          <p className="text-sm text-slate-400 mt-0.5">
            Chaque commande en ligne crédite le wallet de l'agence concernée.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={() => qc.invalidateQueries({ queryKey: ["wallet"] })}>
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button onClick={() => setWithdrawOpen(true)} disabled={!walletData || walletData.total_balance <= 0}>
            <ArrowDownToLine className="h-4 w-4 mr-2" />
            Retirer des fonds
          </Button>
        </div>
      </div>

      {/* Totaux */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card className="border-brand-500/30 bg-brand-500/5">
          <CardContent className="p-6">
            {walletLoading ? <Skeleton className="h-16 w-full" /> : (
              <div>
                <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">Solde total</p>
                <p className="text-3xl font-black text-brand-400">
                  {formatCurrency(walletData?.total_balance ?? 0)}
                </p>
                <p className="text-xs text-slate-500 mt-1">{branches.length} agence{branches.length > 1 ? "s" : ""}</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            {walletLoading ? <Skeleton className="h-16 w-full" /> : (
              <div className="flex items-start gap-3">
                <div className="h-10 w-10 rounded-lg bg-green-500/10 flex items-center justify-center shrink-0">
                  <TrendingUp className="h-5 w-5 text-green-400" />
                </div>
                <div>
                  <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">Total crédité</p>
                  <p className="text-xl font-bold text-slate-900">{formatCurrency(walletData?.total_credited ?? 0)}</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            {walletLoading ? <Skeleton className="h-16 w-full" /> : (
              <div className="flex items-start gap-3">
                <div className="h-10 w-10 rounded-lg bg-amber-500/10 flex items-center justify-center shrink-0">
                  <TrendingDown className="h-5 w-5 text-amber-400" />
                </div>
                <div>
                  <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">Total retiré</p>
                  <p className="text-xl font-bold text-slate-900">{formatCurrency(walletData?.total_withdrawn ?? 0)}</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Wallets par agence */}
      {walletLoading ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-28 w-full rounded-xl" />
          ))}
        </div>
      ) : branches.length > 0 ? (
        <div>
          <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">
            Détail par agence
          </h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {branches.map((b) => (
              <Card
                key={b.branch_id}
                className="cursor-pointer hover:border-brand-500/40 transition-colors"
                onClick={() => {
                  setBranchFilter(b.branch_id);
                  setPage(1);
                }}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className="h-8 w-8 rounded-lg bg-brand-500/10 flex items-center justify-center shrink-0">
                        <Store className="h-4 w-4 text-brand-400" />
                      </div>
                      <span className="text-sm font-medium text-slate-900 truncate max-w-[130px]">
                        {b.branch_name}
                      </span>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs px-2 shrink-0"
                      onClick={(e) => {
                        e.stopPropagation();
                        setWithdrawBranch(b.branch_id);
                        setWithdrawOpen(true);
                      }}
                      disabled={b.balance <= 0}
                    >
                      Retirer
                    </Button>
                  </div>
                  <p className="text-2xl font-bold text-brand-400">{formatCurrency(b.balance)}</p>
                  <div className="flex gap-3 mt-2">
                    <p className="text-xs text-slate-500">
                      +{formatCurrency(b.total_credited)} crédités
                    </p>
                    <p className="text-xs text-slate-500">
                      −{formatCurrency(b.total_withdrawn)} retirés
                    </p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      ) : (
        <div className="rounded-lg border border-slate-200 bg-slate-50 py-10 text-center text-slate-500 text-sm">
          Aucune agence avec un wallet actif. Les wallets sont créés automatiquement lors du premier paiement en ligne.
        </div>
      )}

      {/* Info commission */}
      <div className="flex items-start gap-2 rounded-lg border border-blue-500/20 bg-blue-500/5 px-4 py-3">
        <AlertCircle className="h-4 w-4 text-blue-400 mt-0.5 shrink-0" />
        <p className="text-sm text-blue-300">
          Chaque commande en ligne crédite le wallet de l'agence <strong>sans frais</strong>.
          Lors d'un retrait, <strong>1,5%</strong> est prélevé par Dash Meal + les frais Campay.
        </p>
      </div>

      {/* Historique */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3 gap-2 flex-wrap">
          <CardTitle className="text-base">Historique des transactions</CardTitle>
          <div className="flex gap-2">
            {/* Filtre agence */}
            <Select value={branchFilter} onValueChange={(v) => { setBranchFilter(v); setPage(1); }}>
              <SelectTrigger className="w-44">
                <SelectValue placeholder="Toutes les agences" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes les agences</SelectItem>
                {branches.map((b) => (
                  <SelectItem key={b.branch_id} value={b.branch_id}>{b.branch_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {/* Filtre type */}
            <Select value={typeFilter} onValueChange={(v) => { setTypeFilter(v); setPage(1); }}>
              <SelectTrigger className="w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes</SelectItem>
                <SelectItem value="credit">Crédits</SelectItem>
                <SelectItem value="withdrawal">Retraits</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Agence</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Description</TableHead>
              <TableHead className="text-right">Montant</TableHead>
              <TableHead className="text-right">Solde après</TableHead>
              <TableHead>Statut</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {txLoading
              ? Array.from({ length: 8 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 7 }).map((_, j) => (
                      <TableCell key={j}><Skeleton className="h-5 w-full" /></TableCell>
                    ))}
                  </TableRow>
                ))
              : transactions.length === 0
                ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-slate-500 py-10">
                      Aucune transaction pour le moment
                    </TableCell>
                  </TableRow>
                )
                : transactions.map((tx) => (
                  <TableRow key={tx.id}>
                    <TableCell className="text-sm text-slate-400 whitespace-nowrap">
                      {formatDateTime(tx.created_at)}
                    </TableCell>
                    <TableCell className="text-sm text-slate-700">
                      {(tx.branches as any)?.name ?? "—"}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        {tx.type === "credit"
                          ? <Plus  className="h-3.5 w-3.5 text-green-400" />
                          : <Minus className="h-3.5 w-3.5 text-amber-400" />
                        }
                        <Badge variant={tx.type === "credit" ? "success" : "pending"}>
                          {tx.type === "credit" ? "Crédit" : "Retrait"}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-slate-700 max-w-xs truncate">
                      {tx.description}
                      {tx.type === "withdrawal" && tx.platform_fee != null && (
                        <span className="block text-xs text-slate-500">
                          Frais : {formatCurrency(tx.platform_fee)} — Envoyé : {formatCurrency(tx.net_payout ?? 0)}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className={`text-right font-bold ${tx.type === "credit" ? "text-green-400" : "text-amber-400"}`}>
                      {tx.type === "credit" ? "+" : "−"}{formatCurrency(tx.amount)}
                    </TableCell>
                    <TableCell className="text-right text-sm text-slate-700">
                      {formatCurrency(tx.balance_after)}
                    </TableCell>
                    <TableCell>
                      <Badge variant={tx.status === "completed" ? "success" : tx.status === "failed" ? "destructive" : "pending"}>
                        {tx.status === "completed" ? "Complété" : tx.status === "failed" ? "Échoué" : "En cours"}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))
            }
          </TableBody>
        </Table>
        {txData?.pagination && (
          <div className="p-4 border-t border-slate-200">
            <Pagination
              page={txData.pagination.page}
              totalPages={txData.pagination.total_pages}
              total={txData.pagination.total}
              limit={txData.pagination.limit}
              onPageChange={setPage}
            />
          </div>
        )}
      </Card>

      {/* Modal retrait */}
      <Dialog open={withdrawOpen} onOpenChange={(open) => {
        setWithdrawOpen(open);
        if (!open) { setWithdrawAmount(""); setWithdrawPhone(""); setWithdrawBranch(""); }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Retirer des fonds</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">

            {/* Sélection agence */}
            <div className="space-y-1.5">
              <Label>Agence</Label>
              <Select value={withdrawBranch} onValueChange={setWithdrawBranch}>
                <SelectTrigger>
                  <SelectValue placeholder="Choisir une agence" />
                </SelectTrigger>
                <SelectContent>
                  {branches.filter((b) => b.balance > 0).map((b) => (
                    <SelectItem key={b.branch_id} value={b.branch_id}>
                      {b.branch_name} — {formatCurrency(b.balance)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Solde de l'agence sélectionnée */}
            {withdrawBranch && (
              <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
                <p className="text-xs text-slate-400">Solde disponible</p>
                <p className="text-2xl font-bold text-brand-400">{formatCurrency(selectedBranchBalance)}</p>
              </div>
            )}

            <div className="space-y-1.5">
              <Label>Montant à retirer (FCFA)</Label>
              <Input
                type="number"
                placeholder="Ex : 50000"
                value={withdrawAmount}
                onChange={(e) => setWithdrawAmount(e.target.value)}
                min={1}
                max={selectedBranchBalance || undefined}
              />
            </div>

            <div className="space-y-1.5">
              <Label>Numéro Mobile Money</Label>
              <Input
                type="tel"
                placeholder="6XXXXXXXX"
                value={withdrawPhone}
                onChange={(e) => setWithdrawPhone(e.target.value)}
              />
            </div>

            {withdrawAmount && parseFloat(withdrawAmount) > 0 && (
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 space-y-1.5 text-sm">
                <div className="flex justify-between text-slate-400">
                  <span>Montant demandé</span>
                  <span>{formatCurrency(parseFloat(withdrawAmount))}</span>
                </div>
                <div className="flex justify-between text-amber-400">
                  <span>Frais plateforme (1,5%)</span>
                  <span>— {formatCurrency(platformFeePreview)}</span>
                </div>
                <div className="flex justify-between font-bold text-slate-900 border-t border-slate-200 pt-1.5">
                  <span>Vous recevrez</span>
                  <span className="text-green-400">{formatCurrency(netPayoutPreview)}</span>
                </div>
              </div>
            )}

            <div className="flex gap-3 pt-1">
              <Button variant="ghost" className="flex-1" onClick={() => setWithdrawOpen(false)}>
                Annuler
              </Button>
              <Button
                className="flex-1"
                onClick={handleWithdraw}
                disabled={withdrawMutation.isPending || !withdrawAmount || !withdrawPhone || !withdrawBranch}
              >
                {withdrawMutation.isPending ? "Traitement…" : "Confirmer le retrait"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
