"use client";
import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { apiGet, apiPost } from "@/lib/api";
import { formatDateTime } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Pagination } from "@/components/ui/pagination";
import { Bell, Send, Users, Megaphone } from "lucide-react";

interface Notification {
  id: string; title: string; body: string; type: string;
  is_read: boolean; created_at: string;
  users?: { name: string; phone: string };
}

const NotifSchema = z.object({
  title_fr: z.string().min(1),
  title_en: z.string().min(1),
  body_fr: z.string().min(1),
  body_en: z.string().min(1),
  type: z.enum(["general", "promo", "order"]),
});
type NotifForm = z.infer<typeof NotifSchema>;

export default function NotificationsPage() {
  const t = useTranslations("notifications");
  const [tab, setTab] = useState("send");
  const [mode, setMode] = useState<"broadcast" | "specific">("broadcast");
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery<{ data: Notification[]; pagination: any }>({
    queryKey: ["notifications", page],
    queryFn: () => apiGet("/notifications", { page, limit: 20 }) as any,
    enabled: tab === "history",
  });

  const { register, handleSubmit, reset, setValue, watch, formState: { isSubmitting } } = useForm<NotifForm>({
    resolver: zodResolver(NotifSchema),
    defaultValues: { type: "general" },
  });

  const sendMutation = useMutation({
    mutationFn: (d: NotifForm) => {
      if (mode === "broadcast") {
        return apiPost("/notifications/broadcast", {
          title: { fr: d.title_fr, en: d.title_en },
          body: { fr: d.body_fr, en: d.body_en },
          type: d.type,
        });
      }
      return apiPost("/notifications/send", {
        title: { fr: d.title_fr, en: d.title_en },
        body: { fr: d.body_fr, en: d.body_en },
        type: d.type,
      });
    },
    onSuccess: () => {
      toast.success(t("sent"));
      reset();
    },
    onError: () => toast.error("Erreur lors de l'envoi"),
  });

  const typeOptions = [
    { value: "general", label: t("general") },
    { value: "promo",   label: t("promo") },
    { value: "order",   label: t("order") },
  ];

  return (
    <div className="space-y-5 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">{t("title")}</h1>
        <p className="text-sm text-slate-400">{t("subtitle")}</p>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="send">
            <Send className="h-3.5 w-3.5 mr-1.5" /> {t("send")}
          </TabsTrigger>
          <TabsTrigger value="history">
            <Bell className="h-3.5 w-3.5 mr-1.5" /> {t("history")}
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {tab === "send" && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          {/* Compose panel */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Megaphone className="h-4 w-4 text-brand-400" /> Composer une notification
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit((d) => sendMutation.mutate(d))} className="space-y-5">
                {/* Mode selector */}
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setMode("broadcast")}
                    className={`flex-1 flex items-center gap-2 rounded-xl border p-3 text-sm transition-colors ${
                      mode === "broadcast"
                        ? "border-brand-500 bg-brand-500/10 text-brand-400"
                        : "border-slate-200 text-slate-400 hover:border-slate-300"
                    }`}
                  >
                    <Users className="h-4 w-4" />
                    <div className="text-left">
                      <p className="font-medium">{t("sendAll")}</p>
                      <p className="text-xs opacity-60">Tous les utilisateurs</p>
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setMode("specific")}
                    className={`flex-1 flex items-center gap-2 rounded-xl border p-3 text-sm transition-colors ${
                      mode === "specific"
                        ? "border-brand-500 bg-brand-500/10 text-brand-400"
                        : "border-slate-200 text-slate-400 hover:border-slate-300"
                    }`}
                  >
                    <Bell className="h-4 w-4" />
                    <div className="text-left">
                      <p className="font-medium">{t("sendSpecific")}</p>
                      <p className="text-xs opacity-60">Utilisateurs ciblés</p>
                    </div>
                  </button>
                </div>

                {/* Type */}
                <div className="space-y-1.5">
                  <Label>{t("type")}</Label>
                  <Select defaultValue="general" onValueChange={(v) => setValue("type", v as any)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {typeOptions.map((o) => (
                        <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Titre FR / EN */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>{t("titleFr")}</Label>
                    <Input {...register("title_fr")} placeholder="Titre en français" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>{t("titleEn")}</Label>
                    <Input {...register("title_en")} placeholder="Title in English" />
                  </div>
                </div>

                {/* Body FR / EN */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>{t("bodyFr")}</Label>
                    <Textarea {...register("body_fr")} placeholder="Message en français..." rows={3} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>{t("bodyEn")}</Label>
                    <Textarea {...register("body_en")} placeholder="Message in English..." rows={3} />
                  </div>
                </div>

                <Button type="submit" className="w-full" disabled={isSubmitting || sendMutation.isPending}>
                  <Send className="h-4 w-4 mr-2" />
                  {sendMutation.isPending ? "Envoi..." : t("send")}
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Tips */}
          <Card className="h-fit">
            <CardHeader>
              <CardTitle className="text-base">Conseils</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-slate-400">
              <div className="rounded-lg bg-slate-100 p-3">
                <p className="text-brand-400 font-medium mb-1">Broadcast</p>
                <p>Envoie la notification à tous les utilisateurs qui ont activé les notifications push.</p>
              </div>
              <div className="rounded-lg bg-slate-100 p-3">
                <p className="text-blue-400 font-medium mb-1">Bilingue</p>
                <p>Remplissez les champs FR et EN pour que chaque utilisateur reçoive la notification dans sa langue.</p>
              </div>
              <div className="rounded-lg bg-slate-100 p-3">
                <p className="text-green-400 font-medium mb-1">Types</p>
                <ul className="mt-1 space-y-0.5 text-xs">
                  <li><span className="text-slate-900">Général</span> — informations générales</li>
                  <li><span className="text-slate-900">Promo</span> — offres et promotions</li>
                  <li><span className="text-slate-900">Commande</span> — mises à jour commandes</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {tab === "history" && (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Titre</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Utilisateur</TableHead>
                <TableHead>Lu</TableHead>
                <TableHead>Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading
                ? Array.from({ length: 8 }).map((_, i) => (
                    <TableRow key={i}>
                      {Array.from({ length: 5 }).map((_, j) => (
                        <TableCell key={j}><Skeleton className="h-5 w-full" /></TableCell>
                      ))}
                    </TableRow>
                  ))
                : (data?.data ?? []).map((n) => (
                    <TableRow key={n.id}>
                      <TableCell>
                        <p className="font-medium text-slate-900">{n.title}</p>
                        <p className="text-xs text-slate-500 line-clamp-1">{n.body}</p>
                      </TableCell>
                      <TableCell>
                        <Badge variant="info">{n.type}</Badge>
                      </TableCell>
                      <TableCell className="text-slate-700">
                        {n.users?.name ?? <span className="text-slate-500 italic">Broadcast</span>}
                      </TableCell>
                      <TableCell>
                        <Badge variant={n.is_read ? "active" : "inactive"}>
                          {n.is_read ? "Lu" : "Non lu"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-slate-500">{formatDateTime(n.created_at)}</TableCell>
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
      )}
    </div>
  );
}
