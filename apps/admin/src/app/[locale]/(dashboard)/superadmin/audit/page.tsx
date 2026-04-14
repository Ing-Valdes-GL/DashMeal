"use client";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { apiGet } from "@/lib/api";
import { formatDateTime } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Pagination } from "@/components/ui/pagination";
import { RefreshCw, Activity, Search } from "lucide-react";

interface ActivityLog {
  id: string; action: string; resource_type: string; resource_id: string | null;
  actor_id: string; actor_role: string; metadata: Record<string, any> | null;
  created_at: string;
  admins?: { username: string };
  super_admins?: { email: string };
  users?: { name: string };
}

const ROLE_VARIANT: Record<string, any> = {
  admin: "info",
  superadmin: "delivering",
  user: "pending",
  driver: "preparing",
};

const ACTION_COLORS: Record<string, string> = {
  CREATE: "text-green-400",
  UPDATE: "text-blue-400",
  DELETE: "text-red-400",
  LOGIN: "text-brand-400",
  APPROVE: "text-green-400",
  REJECT: "text-red-400",
  SETTLE: "text-purple-400",
};

export default function AuditPage() {
  const t = useTranslations("audit");
  const [page, setPage] = useState(1);
  const [roleFilter, setRoleFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const { data, isLoading, refetch } = useQuery<{ data: ActivityLog[]; pagination: any }>({
    queryKey: ["audit", { page, roleFilter, search, dateFrom, dateTo }],
    queryFn: () => apiGet("/audit", {
      page, limit: 50,
      ...(roleFilter !== "all" && { actor_role: roleFilter }),
      ...(search && { action: search }),
      ...(dateFrom && { from: dateFrom }),
      ...(dateTo && { to: dateTo }),
    }) as any,
  });

  const logs = data?.data ?? [];

  const getActorName = (log: ActivityLog) => {
    if (log.actor_role === "admin") return log.admins?.username ?? log.actor_id.slice(0, 8);
    if (log.actor_role === "superadmin") return log.super_admins?.email ?? log.actor_id.slice(0, 8);
    if (log.actor_role === "user") return log.users?.name ?? log.actor_id.slice(0, 8);
    return log.actor_id.slice(0, 8);
  };

  const getActionColor = (action: string) => {
    const key = Object.keys(ACTION_COLORS).find((k) => action.toUpperCase().includes(k));
    return key ? ACTION_COLORS[key] : "text-slate-300";
  };

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">{t("title")}</h1>
          <p className="text-sm text-slate-400">{t("subtitle")}</p>
        </div>
        <Button variant="ghost" size="sm" onClick={() => refetch()}><RefreshCw className="h-4 w-4" /></Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-3">
            <div className="relative flex-1 min-w-[180px] max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
              <Input
                placeholder="Filtrer par action..."
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                className="pl-9"
              />
            </div>

            <Select value={roleFilter} onValueChange={(v) => { setRoleFilter(v); setPage(1); }}>
              <SelectTrigger className="w-36">
                <SelectValue placeholder={t("filterByRole")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les rôles</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="superadmin">Super Admin</SelectItem>
                <SelectItem value="user">Utilisateur</SelectItem>
                <SelectItem value="driver">Livreur</SelectItem>
              </SelectContent>
            </Select>

            <div className="flex items-center gap-2">
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => { setDateFrom(e.target.value); setPage(1); }}
                className="w-40"
              />
              <span className="text-slate-500 text-sm">—</span>
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => { setDateTo(e.target.value); setPage(1); }}
                className="w-40"
              />
            </div>

            {(search || roleFilter !== "all" || dateFrom || dateTo) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => { setSearch(""); setRoleFilter("all"); setDateFrom(""); setDateTo(""); setPage(1); }}
              >
                Réinitialiser
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("date")}</TableHead>
              <TableHead>{t("actor")}</TableHead>
              <TableHead>{t("role")}</TableHead>
              <TableHead>{t("action")}</TableHead>
              <TableHead>{t("resource")}</TableHead>
              <TableHead>Détails</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading
              ? Array.from({ length: 12 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 6 }).map((_, j) => (
                      <TableCell key={j}><Skeleton className="h-5 w-full" /></TableCell>
                    ))}
                  </TableRow>
                ))
              : logs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-12 text-slate-500">
                      <Activity className="h-8 w-8 mx-auto mb-2 opacity-30" />
                      Aucun journal d'activité
                    </TableCell>
                  </TableRow>
                )
              : logs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="text-xs text-slate-500 whitespace-nowrap">
                      {formatDateTime(log.created_at)}
                    </TableCell>
                    <TableCell>
                      <p className="text-white text-sm font-medium">{getActorName(log)}</p>
                    </TableCell>
                    <TableCell>
                      <Badge variant={ROLE_VARIANT[log.actor_role] ?? "info"}>
                        {log.actor_role}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <span className={`text-sm font-mono font-medium ${getActionColor(log.action)}`}>
                        {log.action}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div>
                        <span className="text-xs uppercase tracking-wider text-slate-500">{log.resource_type}</span>
                        {log.resource_id && (
                          <p className="text-xs font-mono text-slate-600">#{log.resource_id.slice(0, 8)}</p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {log.metadata && Object.keys(log.metadata).length > 0 && (
                        <span className="text-xs text-slate-500 font-mono line-clamp-1 max-w-[200px]">
                          {JSON.stringify(log.metadata)}
                        </span>
                      )}
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
    </div>
  );
}
