"use client";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiGet } from "@/lib/api";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Pagination } from "@/components/ui/pagination";
import { Wallet, TrendingUp, ArrowDownToLine, Building2 } from "lucide-react";

interface PlatformWallet {
  id: string;
  balance: number;
  total_received: number;
  updated_at: string;
}

interface PlatformTransaction {
  id: string;
  amount: number;
  brand_withdrawal_amount: number;
  description: string;
  created_at: string;
  brands?: { name: string } | null;
}

export default function SuperadminWalletPage() {
  const [page, setPage] = useState(1);

  const { data: wallet, isLoading: walletLoading } = useQuery<PlatformWallet>({
    queryKey: ["platform-wallet"],
    queryFn: () => apiGet("/wallet/platform"),
  });

  const { data: txData, isLoading: txLoading } = useQuery<{ data: PlatformTransaction[]; pagination: any }>({
    queryKey: ["platform-wallet-transactions", page],
    queryFn: () => apiGet("/wallet/platform/transactions", { page, limit: 20 }) as any,
  });

  const transactions = txData?.data ?? [];

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
          <Wallet className="h-6 w-6 text-brand-400" />
          Wallet Plateforme
        </h1>
        <p className="text-sm text-slate-400 mt-0.5">
          Commissions de 1,5% prélevées sur chaque retrait d'agence.
        </p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {/* Solde actuel */}
        <Card className="border-brand-500/30 bg-brand-500/5">
          <CardContent className="p-6">
            {walletLoading ? <Skeleton className="h-16 w-full" /> : (
              <div>
                <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">Solde disponible</p>
                <p className="text-3xl font-black text-brand-400">
                  {formatCurrency(wallet?.balance ?? 0)}
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  Mis à jour {wallet ? formatDateTime(wallet.updated_at) : "—"}
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Total reçu */}
        <Card>
          <CardContent className="p-6">
            {walletLoading ? <Skeleton className="h-16 w-full" /> : (
              <div className="flex items-start gap-3">
                <div className="h-10 w-10 rounded-lg bg-green-500/10 flex items-center justify-center shrink-0">
                  <TrendingUp className="h-5 w-5 text-green-400" />
                </div>
                <div>
                  <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">Total reçu</p>
                  <p className="text-xl font-bold text-slate-900">{formatCurrency(wallet?.total_received ?? 0)}</p>
                  <p className="text-xs text-slate-500">Commissions accumulées</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Historique */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <ArrowDownToLine className="h-4 w-4 text-brand-400" />
            Commissions reçues
          </CardTitle>
        </CardHeader>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Marque</TableHead>
              <TableHead>Description</TableHead>
              <TableHead className="text-right">Retrait agence</TableHead>
              <TableHead className="text-right">Commission (1,5%)</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {txLoading
              ? Array.from({ length: 8 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 5 }).map((_, j) => (
                      <TableCell key={j}><Skeleton className="h-5 w-full" /></TableCell>
                    ))}
                  </TableRow>
                ))
              : transactions.length === 0
                ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-slate-500 py-10">
                      Aucune commission pour le moment
                    </TableCell>
                  </TableRow>
                )
                : transactions.map((tx) => (
                  <TableRow key={tx.id}>
                    <TableCell className="text-sm text-slate-400 whitespace-nowrap">
                      {formatDateTime(tx.created_at)}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Building2 className="h-4 w-4 text-slate-500" />
                        <span className="text-sm text-slate-900 font-medium">
                          {tx.brands?.name ?? "—"}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-slate-400 max-w-xs truncate">
                      {tx.description}
                    </TableCell>
                    <TableCell className="text-right text-sm text-slate-700">
                      {formatCurrency(tx.brand_withdrawal_amount)}
                    </TableCell>
                    <TableCell className="text-right font-bold text-green-400">
                      +{formatCurrency(tx.amount)}
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
    </div>
  );
}
