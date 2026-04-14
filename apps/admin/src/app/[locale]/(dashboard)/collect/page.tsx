"use client";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { apiGet, apiPost } from "@/lib/api";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { QrCode, ScanLine, CheckCircle, XCircle, RefreshCw, Calendar } from "lucide-react";
import { useAuthStore } from "@/stores/auth";

interface CollectOrder {
  id: string; qr_code: string; pickup_status: "waiting" | "picked_up"; picked_up_at: string | null;
  orders: { id: string; total: number; status: string; users: { name: string; phone: string } };
  time_slots: { date: string; start_time: string; end_time: string; branches?: { name: string } };
}
interface Branch { id: string; name: string }

export default function CollectPage() {
  const t = useTranslations("collect");
  const { user } = useAuthStore();
  const qc = useQueryClient();
  const [qrInput, setQrInput] = useState("");
  const [selectedBranch, setSelectedBranch] = useState<string>("");
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().slice(0, 10));
  const [statusFilter, setStatusFilter] = useState("all");
  const [scanResult, setScanResult] = useState<{ success: boolean; message: string; data?: any } | null>(null);

  const { data: branches } = useQuery<Branch[]>({
    queryKey: ["branches"],
    queryFn: () => apiGet("/branches"),
  });

  const firstBranch = branches?.[0]?.id ?? "";
  const branchId = selectedBranch || firstBranch;

  const { data: collects, isLoading, refetch } = useQuery<CollectOrder[]>({
    queryKey: ["collects", branchId, selectedDate, statusFilter],
    queryFn: () => apiGet(`/collect/branch/${branchId}`, {
      date: selectedDate,
      ...(statusFilter !== "all" && { status: statusFilter }),
    }),
    enabled: !!branchId,
  });

  const scanMutation = useMutation({
    mutationFn: (qr_code: string) => apiPost("/collect/scan", { qr_code }),
    onSuccess: (data: any) => {
      setScanResult({ success: true, message: t("scanSuccess"), data });
      qc.invalidateQueries({ queryKey: ["collects"] });
      setQrInput("");
      toast.success(t("scanSuccess"));
    },
    onError: (error: any) => {
      const msg = error?.response?.data?.error?.message ?? t("scanError");
      setScanResult({ success: false, message: msg });
      toast.error(t("scanError"), msg);
    },
  });

  const handleScan = () => {
    if (!qrInput.trim()) return;
    setScanResult(null);
    scanMutation.mutate(qrInput.trim());
  };

  return (
    <div className="space-y-5 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-white">{t("title")}</h1>
        <p className="text-sm text-slate-400">{t("subtitle")}</p>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Scanner QR */}
        <Card className="lg:col-span-1">
          <CardHeader><CardTitle className="text-base flex items-center gap-2">
            <QrCode className="h-5 w-5 text-brand-400" /> {t("scanQr")}
          </CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label>QR Code</Label>
              <div className="flex gap-2">
                <Input
                  value={qrInput}
                  onChange={(e) => setQrInput(e.target.value)}
                  placeholder="Scanner ou saisir le code..."
                  onKeyDown={(e) => e.key === "Enter" && handleScan()}
                  autoFocus
                />
                <Button onClick={handleScan} disabled={scanMutation.isPending || !qrInput}>
                  <ScanLine className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Résultat du scan */}
            {scanResult && (
              <div className={`rounded-xl border p-4 flex items-start gap-3 ${
                scanResult.success
                  ? "border-green-500/30 bg-green-500/10"
                  : "border-red-500/30 bg-red-500/10"
              }`}>
                {scanResult.success
                  ? <CheckCircle className="h-5 w-5 text-green-400 shrink-0 mt-0.5" />
                  : <XCircle className="h-5 w-5 text-red-400 shrink-0 mt-0.5" />}
                <div>
                  <p className={`text-sm font-medium ${scanResult.success ? "text-green-300" : "text-red-300"}`}>
                    {scanResult.message}
                  </p>
                  {scanResult.success && scanResult.data && (
                    <div className="mt-2 space-y-1 text-xs text-slate-400">
                      <p><span className="text-slate-500">Client :</span> {scanResult.data.customer?.name}</p>
                      <p><span className="text-slate-500">Total :</span> {formatCurrency(scanResult.data.total)}</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Liste des retraits */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Liste des retraits</CardTitle>
              <Button variant="ghost" size="icon-sm" onClick={() => refetch()}><RefreshCw className="h-4 w-4" /></Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {/* Filtres */}
            <div className="flex gap-2 p-4 border-b border-surface-700/50">
              <Select value={branchId} onValueChange={setSelectedBranch}>
                <SelectTrigger className="flex-1"><SelectValue placeholder="Agence" /></SelectTrigger>
                <SelectContent>
                  {(branches ?? []).map((b) => (
                    <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                <Input type="date" value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="pl-9 w-40" />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-36">
                  <SelectValue placeholder="Statut" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous</SelectItem>
                  <SelectItem value="waiting">{t("waiting")}</SelectItem>
                  <SelectItem value="picked_up">{t("pickedUp")}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Client</TableHead>
                  <TableHead>Créneau</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Statut</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading
                  ? Array.from({ length: 5 }).map((_, i) => (
                      <TableRow key={i}>
                        {Array.from({ length: 4 }).map((_, j) => (
                          <TableCell key={j}><Skeleton className="h-5 w-full" /></TableCell>
                        ))}
                      </TableRow>
                    ))
                  : (collects ?? []).length === 0
                  ? (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center py-12 text-slate-500">
                          Aucun retrait pour ce jour
                        </TableCell>
                      </TableRow>
                    )
                  : (collects ?? []).map((c) => (
                      <TableRow key={c.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium text-white">{c.orders?.users?.name}</p>
                            <p className="text-xs text-slate-500">{c.orders?.users?.phone}</p>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm text-slate-400">
                          {c.time_slots?.start_time} – {c.time_slots?.end_time}
                        </TableCell>
                        <TableCell className="font-semibold text-white">
                          {formatCurrency(c.orders?.total)}
                        </TableCell>
                        <TableCell>
                          <Badge variant={c.pickup_status === "picked_up" ? "delivered" : "pending"}>
                            {c.pickup_status === "picked_up" ? t("pickedUp") : t("waiting")}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
