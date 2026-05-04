"use client";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { branchApiGet, branchApiPost } from "@/lib/branch-api";
import { useBranchAuthStore } from "@/stores/branch-auth";
import { formatCurrency } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Wallet, ArrowDownLeft, ArrowUpRight, TrendingUp, Clock } from "lucide-react";

interface BranchWallet {
  id: string;
  branch_id: string;
  balance: number;
  total_revenue: number;
  total_withdrawn: number;
}

interface WalletTransaction {
  id: string;
  type: "credit" | "withdrawal";
  amount: number;
  status: "pending" | "completed" | "rejected";
  note: string | null;
  created_at: string;
}

const TX_STATUS: Record<string, string> = {
  pending:   "bg-yellow-100 text-yellow-800",
  completed: "bg-green-100 text-green-800",
  rejected:  "bg-red-100 text-red-800",
};

const TX_STATUS_LABELS: Record<string, string> = {
  pending:   "En attente",
  completed: "Complété",
  rejected:  "Rejeté",
};

function TransactionRow({ tx }: { tx: WalletTransaction }) {
  const isCredit = tx.type === "credit";
  return (
    <div className="flex items-center gap-3 py-3 border-b border-slate-100 last:border-0">
      <div className={`flex items-center justify-center h-9 w-9 rounded-full shrink-0 ${isCredit ? "bg-green-100" : "bg-orange-100"}`}>
        {isCredit
          ? <ArrowDownLeft className="h-4 w-4 text-green-600" />
          : <ArrowUpRight className="h-4 w-4 text-orange-600" />
        }
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-slate-800">{isCredit ? "Revenu commande" : "Retrait"}</p>
        {tx.note && <p className="text-xs text-slate-400 truncate">{tx.note}</p>}
        <p className="text-[11px] text-slate-400 mt-0.5">{new Date(tx.created_at).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</p>
      </div>
      <div className="text-right shrink-0">
        <p className={`text-sm font-bold ${isCredit ? "text-green-600" : "text-slate-800"}`}>
          {isCredit ? "+" : "-"}{formatCurrency(tx.amount)}
        </p>
        <Badge className={`text-[10px] mt-0.5 ${TX_STATUS[tx.status] ?? ""}`}>
          {TX_STATUS_LABELS[tx.status] ?? tx.status}
        </Badge>
      </div>
    </div>
  );
}

export default function BranchWalletPage() {
  const { manager } = useBranchAuthStore();
  const qc = useQueryClient();
  const [showWithdraw, setShowWithdraw] = useState(false);
  const [amount, setAmount] = useState("");
  const [phone, setPhone] = useState("");

  const branchId = manager?.branch_id;

  const { data: wallet, isLoading: walletLoading } = useQuery<BranchWallet>({
    queryKey: ["branch-wallet", branchId],
    queryFn:  () => branchApiGet(`/wallet/branch/${branchId}`),
    enabled:  !!branchId,
  });

  const { data: txs = [], isLoading: txLoading } = useQuery<WalletTransaction[]>({
    queryKey: ["branch-wallet-txs", branchId],
    queryFn:  () => branchApiGet(`/wallet/branch/${branchId}/transactions`, { limit: 50 }),
    enabled:  !!branchId,
    select: (d: any) => Array.isArray(d) ? d : d?.data ?? [],
  });

  const withdrawMutation = useMutation({
    mutationFn: () => branchApiPost(`/wallet/branch/${branchId}/withdraw`, {
      amount: parseInt(amount),
      phone,
    }),
    onSuccess: () => {
      toast.success("Demande de retrait envoyée");
      qc.invalidateQueries({ queryKey: ["branch-wallet"] });
      qc.invalidateQueries({ queryKey: ["branch-wallet-txs"] });
      setShowWithdraw(false);
      setAmount("");
      setPhone("");
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.error?.message ?? "Retrait échoué";
      toast.error(msg);
    },
  });

  const amountNum = parseInt(amount) || 0;
  const canWithdraw = amountNum >= 500 && phone.length >= 8 && amountNum <= (wallet?.balance ?? 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Wallet Agence</h1>
        <p className="text-sm text-slate-500 mt-0.5">Solde et transactions de votre agence</p>
      </div>

      {/* Balance cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border-brand-100 bg-gradient-to-br from-brand-600 to-brand-700 text-white col-span-1 sm:col-span-1">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-medium opacity-80">Solde disponible</p>
              <Wallet className="h-5 w-5 opacity-70" />
            </div>
            {walletLoading ? (
              <Skeleton className="h-10 w-32 bg-white/20" />
            ) : (
              <p className="text-3xl font-bold">{formatCurrency(wallet?.balance ?? 0)}</p>
            )}
            <Button
              size="sm"
              className="mt-4 bg-white text-brand-700 hover:bg-brand-50 font-semibold w-full"
              onClick={() => setShowWithdraw(true)}
              disabled={!wallet || wallet.balance < 500}
            >
              Retirer des fonds
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="h-4 w-4 text-green-500" />
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Total encaissé</p>
            </div>
            {walletLoading ? <Skeleton className="h-8 w-24" /> : (
              <p className="text-2xl font-bold text-slate-800">{formatCurrency(wallet?.total_revenue ?? 0)}</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-2 mb-2">
              <ArrowUpRight className="h-4 w-4 text-orange-500" />
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Total retiré</p>
            </div>
            {walletLoading ? <Skeleton className="h-8 w-24" /> : (
              <p className="text-2xl font-bold text-slate-800">{formatCurrency(wallet?.total_withdrawn ?? 0)}</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Transactions */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold text-slate-700 flex items-center gap-2">
            <Clock className="h-4 w-4 text-slate-400" />
            Historique des transactions
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0 px-4">
          {txLoading ? (
            <div className="space-y-3 py-3">
              {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}
            </div>
          ) : txs.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-8">Aucune transaction</p>
          ) : (
            txs.map((tx) => <TransactionRow key={tx.id} tx={tx} />)
          )}
        </CardContent>
      </Card>

      {/* Withdraw dialog */}
      <Dialog open={showWithdraw} onOpenChange={setShowWithdraw}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Demande de retrait</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="rounded-lg bg-slate-50 p-3 text-sm">
              <p className="text-slate-500">Solde disponible</p>
              <p className="text-xl font-bold text-slate-900 mt-0.5">{formatCurrency(wallet?.balance ?? 0)}</p>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-600">Montant (min. 500 FCFA)</label>
              <Input
                type="number"
                min={500}
                max={wallet?.balance ?? 0}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="Ex: 5000"
              />
              {amountNum > (wallet?.balance ?? 0) && (
                <p className="text-xs text-red-500">Montant supérieur au solde disponible</p>
              )}
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-600">Numéro Mobile Money</label>
              <Input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+237 6XX XXX XXX"
              />
            </div>
            <Button
              className="w-full bg-brand-600 hover:bg-brand-700"
              disabled={!canWithdraw || withdrawMutation.isPending}
              onClick={() => withdrawMutation.mutate()}
            >
              {withdrawMutation.isPending ? "Envoi..." : "Confirmer le retrait"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
