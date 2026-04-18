"use client";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { apiGet, apiPatch } from "@/lib/api";
import { formatDateTime } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Pagination } from "@/components/ui/pagination";
import { Search, MoreHorizontal, ShieldOff, ShieldCheck, RefreshCw, Users } from "lucide-react";

interface User {
  id: string; name: string; phone: string; is_verified: boolean;
  is_active?: boolean; created_at: string;
  orders?: { count: number }[];
}

export default function SuperAdminUsersPage() {
  const t = useTranslations("users");
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [confirm, setConfirm] = useState<{ user: User; action: "suspend" | "activate" } | null>(null);

  const { data, isLoading, refetch } = useQuery<{ data: User[]; pagination: any }>({
    queryKey: ["sa-users", { page, search }],
    queryFn: () => apiGet("/users", {
      page, limit: 20,
      ...(search && { q: search }),
    }) as any,
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, is_active }: { id: string; is_active: boolean }) =>
      apiPatch(`/users/${id}`, { is_active }),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["sa-users"] });
      toast.success(vars.is_active ? "Utilisateur réactivé" : "Utilisateur suspendu");
      setConfirm(null);
    },
    onError: () => toast.error("Erreur"),
  });

  const users = data?.data ?? [];

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{t("title")}</h1>
          <p className="text-sm text-slate-400">{t("subtitle")}</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 text-sm text-slate-500">
            <Users className="h-4 w-4" />
            {data?.pagination?.total ?? 0} utilisateurs
          </div>
          <Button variant="ghost" size="sm" onClick={() => refetch()}><RefreshCw className="h-4 w-4" /></Button>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
        <Input
          placeholder="Nom ou téléphone..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          className="pl-9"
        />
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("name")}</TableHead>
              <TableHead>{t("phone")}</TableHead>
              <TableHead>{t("verified")}</TableHead>
              <TableHead>Statut</TableHead>
              <TableHead>{t("createdAt")}</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading
              ? Array.from({ length: 10 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 6 }).map((_, j) => (
                      <TableCell key={j}><Skeleton className="h-5 w-full" /></TableCell>
                    ))}
                  </TableRow>
                ))
              : users.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-full bg-slate-50 flex items-center justify-center text-xs font-bold text-slate-400">
                          {u.name.slice(0, 2).toUpperCase()}
                        </div>
                        <p className="font-medium text-slate-900">{u.name}</p>
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-slate-700">{u.phone}</TableCell>
                    <TableCell>
                      <Badge variant={u.is_verified ? "active" : "inactive"}>
                        {u.is_verified ? "Vérifié" : "Non vérifié"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={(u.is_active ?? true) ? "active" : "inactive"}>
                        {(u.is_active ?? true) ? "Actif" : "Suspendu"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-slate-500">{formatDateTime(u.created_at)}</TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon-sm"><MoreHorizontal className="h-4 w-4" /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {(u.is_active ?? true) ? (
                            <DropdownMenuItem onClick={() => setConfirm({ user: u, action: "suspend" })}>
                              <ShieldOff className="mr-2 h-4 w-4 text-red-400" /> {t("suspend")}
                            </DropdownMenuItem>
                          ) : (
                            <DropdownMenuItem onClick={() => setConfirm({ user: u, action: "activate" })}>
                              <ShieldCheck className="mr-2 h-4 w-4 text-green-400" /> {t("activate")}
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
          </TableBody>
        </Table>
        {data?.pagination && (
          <div className="p-4 border-t border-slate-200">
            <Pagination page={data.pagination.page} totalPages={data.pagination.total_pages}
              total={data.pagination.total} limit={data.pagination.limit} onPageChange={setPage} />
          </div>
        )}
      </Card>

      {/* Confirm dialog */}
      <Dialog open={!!confirm} onOpenChange={() => setConfirm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {confirm?.action === "suspend" ? t("suspend") : t("activate")} l'utilisateur
            </DialogTitle>
            <DialogDescription>
              {confirm?.action === "suspend"
                ? `L'utilisateur "${confirm.user.name}" sera suspendu et ne pourra plus se connecter.`
                : `L'utilisateur "${confirm?.user.name}" sera réactivé.`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirm(null)}>Annuler</Button>
            <Button
              variant={confirm?.action === "suspend" ? "destructive" : "default"}
              onClick={() => toggleMutation.mutate({ id: confirm!.user.id, is_active: confirm!.action === "activate" })}
              disabled={toggleMutation.isPending}
            >
              {toggleMutation.isPending ? "..." : "Confirmer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
