"use client";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuthStore } from "@/stores/auth";
import { apiGet } from "@/lib/api";
import { formatCurrency } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Wallet, ArrowDownCircle, ArrowUpCircle, RefreshCw,
  ShieldAlert, TrendingUp, Coins,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Transaction {
  id: string;
  wallet_id: string;
  user_id: string;
  type: string;
  amount: number;
  fee_amount: number;
  balance_before: number;
  balance_after: number;
  description: string;
  related_user_name: string | null;
  status: string;
  created_at: string;
}

interface CommissionWallet {
  id: string;
  balance: number;
  total_fees_collected: number;
  updated_at: string;
}

const TX_TYPES: Record<string, { label: string; color: string }> = {
  activation:   { label: "Activation",   color: "bg-purple-100 text-purple-700" },
  topup:        { label: "Recharge",     color: "bg-green-100 text-green-700" },
  payment:      { label: "Paiement",     color: "bg-blue-100 text-blue-700" },
  withdrawal:   { label: "Retrait",      color: "bg-red-100 text-red-700" },
  transfer_in:  { label: "Reçu",         color: "bg-emerald-100 text-emerald-700" },
  transfer_out: { label: "Envoyé",       color: "bg-orange-100 text-orange-700" },
  refund:       { label: "Remboursement",color: "bg-gray-100 text-gray-700" },
};

const TX_SIGN: Record<string, "+" | "-"> = {
  activation: "+", topup: "+", transfer_in: "+", refund: "+",
  payment: "-", withdrawal: "-", transfer_out: "-",
};

export default function UserTransactionsPage() {
  const { user } = useAuthStore();
  const [txType, setTxType] = useState("all");
  const [txPage, setTxPage] = useState(1);
  const [commPage, setCommPage] = useState(1);

  const { data: commissionWallet, isLoading: walletLoading } = useQuery<CommissionWallet>({
    queryKey: ["commission-wallet"],
    queryFn: () => apiGet("/user-wallet/admin/commission"),
    enabled: user?.role === "superadmin",
    staleTime: 30_000,
  });

  const { data: txData, isLoading: txLoading, refetch: refetchTx } = useQuery<{
    data: Transaction[]; pagination: { page: number; limit: number; total: number; total_pages: number };
  }>({
    queryKey: ["user-transactions", txType, txPage],
    queryFn: () => apiGet("/user-wallet/admin/transactions", {
      page: txPage, limit: 50, ...(txType !== "all" && { type: txType }),
    }),
    enabled: user?.role === "superadmin",
    staleTime: 30_000,
  });

  const { data: commData, isLoading: commLoading, refetch: refetchComm } = useQuery<{
    data: Transaction[]; pagination: { page: number; limit: number; total: number; total_pages: number };
  }>({
    queryKey: ["commission-transactions", commPage],
    queryFn: () => apiGet("/user-wallet/admin/commission/transactions", { page: commPage, limit: 50 }),
    enabled: user?.role === "superadmin",
    staleTime: 30_000,
  });

  if (user?.role !== "superadmin") {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <div className="h-16 w-16 rounded-2xl bg-red-500/10 flex items-center justify-center">
          <ShieldAlert className="h-8 w-8 text-red-400" />
        </div>
        <h2 className="text-xl font-bold text-slate-900">Accès restreint</h2>
        <p className="text-sm text-slate-400 text-center max-w-sm">
          Cette page est réservée aux superadmins.
        </p>
      </div>
    );
  }

  const transactions: Transaction[] = txData?.data ?? [];
  const commTransactions: Transaction[] = commData?.data ?? [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Transactions Wallet Utilisateurs</h1>
          <p className="text-sm text-slate-500 mt-1">Supervision des wallets et commission collectée</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => { refetchTx(); refetchComm(); }}
          className="gap-2"
        >
          <RefreshCw className="h-4 w-4" />
          Actualiser
        </Button>
      </div>

      {/* Commission wallet stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          icon={<Wallet className="h-5 w-5 text-violet-500" />}
          bg="bg-violet-500/10"
          title="Solde Commission"
          value={walletLoading ? null : formatCurrency(commissionWallet?.balance ?? 0)}
          sub="Disponible dans le wallet commission"
        />
        <StatCard
          icon={<Coins className="h-5 w-5 text-amber-500" />}
          bg="bg-amber-500/10"
          title="Total Frais Collectés"
          value={walletLoading ? null : formatCurrency(commissionWallet?.total_fees_collected ?? 0)}
          sub="Retraits (2%) + transferts (1%)"
        />
        <StatCard
          icon={<TrendingUp className="h-5 w-5 text-emerald-500" />}
          bg="bg-emerald-500/10"
          title="Transactions Totales"
          value={walletLoading ? null : String(txData?.pagination?.total ?? "—")}
          sub="Toutes les opérations wallet"
        />
      </div>

      {/* User transactions */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-4">
          <CardTitle className="text-base flex items-center gap-2">
            <ArrowDownCircle className="h-4 w-4 text-slate-400" />
            Transactions Utilisateurs
          </CardTitle>
          <div className="flex items-center gap-2">
            <Select value={txType} onValueChange={(v) => { setTxType(v); setTxPage(1); }}>
              <SelectTrigger className="w-40 h-8 text-xs">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous</SelectItem>
                <SelectItem value="activation">Activation</SelectItem>
                <SelectItem value="topup">Recharge</SelectItem>
                <SelectItem value="payment">Paiement</SelectItem>
                <SelectItem value="withdrawal">Retrait</SelectItem>
                <SelectItem value="transfer_in">Reçu</SelectItem>
                <SelectItem value="transfer_out">Envoyé</SelectItem>
                <SelectItem value="refund">Remboursement</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {txLoading ? (
            <div className="p-6 space-y-3">
              {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Type</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="text-right">Montant</TableHead>
                  <TableHead className="text-right">Frais</TableHead>
                  <TableHead className="text-right">Solde après</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transactions.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-slate-400">
                      Aucune transaction
                    </TableCell>
                  </TableRow>
                ) : transactions.map((tx) => {
                  const meta = TX_TYPES[tx.type] ?? { label: tx.type, color: "bg-gray-100 text-gray-700" };
                  const sign = TX_SIGN[tx.type] ?? "+";
                  return (
                    <TableRow key={tx.id}>
                      <TableCell>
                        <span className={cn("text-xs font-semibold px-2 py-1 rounded-full", meta.color)}>
                          {meta.label}
                        </span>
                      </TableCell>
                      <TableCell className="text-sm text-slate-600 max-w-[200px] truncate">
                        {tx.description}
                      </TableCell>
                      <TableCell className={cn("text-right text-sm font-semibold", sign === "+" ? "text-emerald-600" : "text-red-500")}>
                        {sign}{formatCurrency(tx.amount)}
                      </TableCell>
                      <TableCell className="text-right text-sm text-slate-400">
                        {tx.fee_amount > 0 ? formatCurrency(tx.fee_amount) : "—"}
                      </TableCell>
                      <TableCell className="text-right text-sm font-medium">
                        {formatCurrency(tx.balance_after)}
                      </TableCell>
                      <TableCell>
                        <Badge variant={tx.status === "completed" ? "default" : tx.status === "pending" ? "secondary" : "destructive"}>
                          {tx.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-slate-400 whitespace-nowrap">
                        {new Date(tx.created_at).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
          {txData && txData.pagination.total_pages > 1 && (
            <div className="flex items-center justify-between px-6 py-4 border-t">
              <p className="text-xs text-slate-400">Page {txPage} / {txData.pagination.total_pages}</p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={txPage <= 1} onClick={() => setTxPage(p => p - 1)}>Précédent</Button>
                <Button variant="outline" size="sm" disabled={txPage >= txData.pagination.total_pages} onClick={() => setTxPage(p => p + 1)}>Suivant</Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Commission transactions */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-base flex items-center gap-2">
            <ArrowUpCircle className="h-4 w-4 text-violet-400" />
            Transactions Commission (frais collectés)
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {commLoading ? (
            <div className="p-6 space-y-3">
              {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Type</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="text-right">Frais collectés</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {commTransactions.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-8 text-slate-400">
                      Aucun frais collecté
                    </TableCell>
                  </TableRow>
                ) : commTransactions.map((tx) => {
                  const meta = TX_TYPES[tx.type] ?? { label: tx.type, color: "bg-gray-100 text-gray-700" };
                  return (
                    <TableRow key={tx.id}>
                      <TableCell>
                        <span className={cn("text-xs font-semibold px-2 py-1 rounded-full", meta.color)}>
                          {meta.label}
                        </span>
                      </TableCell>
                      <TableCell className="text-sm text-slate-600">{tx.description}</TableCell>
                      <TableCell className="text-right text-sm font-semibold text-violet-600">
                        +{formatCurrency(tx.fee_amount)}
                      </TableCell>
                      <TableCell className="text-xs text-slate-400 whitespace-nowrap">
                        {new Date(tx.created_at).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" })}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
          {commData && commData.pagination.total_pages > 1 && (
            <div className="flex items-center justify-between px-6 py-4 border-t">
              <p className="text-xs text-slate-400">Page {commPage} / {commData.pagination.total_pages}</p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={commPage <= 1} onClick={() => setCommPage(p => p - 1)}>Précédent</Button>
                <Button variant="outline" size="sm" disabled={commPage >= commData.pagination.total_pages} onClick={() => setCommPage(p => p + 1)}>Suivant</Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({ icon, bg, title, value, sub }: { icon: React.ReactNode; bg: string; title: string; value: string | null; sub: string }) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-center gap-3">
          <div className={cn("h-10 w-10 rounded-xl flex items-center justify-center", bg)}>{icon}</div>
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">{title}</p>
            {value === null ? <Skeleton className="h-6 w-24 mt-1" /> : <p className="text-xl font-bold text-slate-900 mt-0.5">{value}</p>}
            <p className="text-xs text-slate-400 mt-0.5">{sub}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
