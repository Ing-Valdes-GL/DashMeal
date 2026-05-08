"use client";
import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiGet, apiPost } from "@/lib/api";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Bell, Send, Users, Clock, CheckCircle2, AlertCircle, Megaphone } from "lucide-react";

interface NotificationHistory {
  id: string;
  title: string;
  body: string;
  created_at: string;
  is_sent: boolean;
}

type Segment = "tous" | "inactifs" | "zone";

export default function NotificationsBroadcastPage() {
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [segment, setSegment] = useState<Segment>("tous");
  const [inactiveDays, setInactiveDays] = useState(7);
  const [zone, setZone] = useState("");
  const [titleError, setTitleError] = useState(false);
  const [messageError, setMessageError] = useState(false);

  const { data: history = [], isLoading } = useQuery<NotificationHistory[]>({
    queryKey: ["notifications-broadcast-history"],
    queryFn: () => apiGet("/notifications", { limit: 20 }),
    staleTime: 60_000,
  });

  const sendMutation = useMutation({
    mutationFn: (payload: { title: string; message: string; segment: string }) =>
      apiPost("/notifications/broadcast", payload),
    onSuccess: () => {
      toast.success("Notification envoyée avec succès", "Tous les appareils ciblés ont été notifiés.");
      setTitle("");
      setMessage("");
      setSegment("tous");
    },
    onError: (e: any) =>
      toast.error("Erreur d'envoi", e?.response?.data?.error?.message ?? "Impossible d'envoyer la notification"),
  });

  function handleSend() {
    let hasError = false;
    if (!title.trim()) { setTitleError(true); hasError = true; } else { setTitleError(false); }
    if (!message.trim()) { setMessageError(true); hasError = true; } else { setMessageError(false); }
    if (hasError) return;

    let segmentValue = segment;
    if (segment === "inactifs") segmentValue = `commande_il_y_a_plus_de_${inactiveDays}_jours` as Segment;
    if (segment === "zone") segmentValue = zone.trim() as Segment || ("zone" as Segment);

    sendMutation.mutate({ title: title.trim(), message: message.trim(), segment: segmentValue });
  }

  const sentCount = history.filter((n) => n.is_sent).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
          <Megaphone className="h-6 w-6 text-brand-400" />
          Notifications Push
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          Envoyez des messages push à vos utilisateurs.
        </p>
      </div>

      {/* Stats rapides */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Total envois", value: history.length, color: "text-slate-900" },
          { label: "Envoyées", value: sentCount, color: "text-green-500" },
          { label: "En attente", value: history.length - sentCount, color: "text-amber-500" },
        ].map((s) => (
          <Card key={s.label}>
            <CardContent className="p-4">
              <p className="text-sm text-slate-400">{s.label}</p>
              <p className={`text-2xl font-bold mt-1 ${s.color}`}>{s.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Compose form */}
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Send className="h-4 w-4 text-brand-400" />
                Composer une notification
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              {/* Title */}
              <div className="space-y-1.5">
                <Label>
                  Titre <span className="text-red-500">*</span>
                </Label>
                <Input
                  placeholder="Ex : Offre spéciale du week-end !"
                  value={title}
                  onChange={(e) => { setTitle(e.target.value); setTitleError(false); }}
                  className={cn(titleError && "border-red-400 focus-visible:ring-red-400")}
                />
                {titleError && (
                  <p className="text-xs text-red-400 flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" /> Le titre est requis
                  </p>
                )}
              </div>

              {/* Message */}
              <div className="space-y-1.5">
                <Label>
                  Message <span className="text-red-500">*</span>
                </Label>
                <Textarea
                  placeholder="Ex : Profitez de -20% sur votre prochaine commande jusqu'à minuit !"
                  rows={4}
                  value={message}
                  onChange={(e) => { setMessage(e.target.value); setMessageError(false); }}
                  className={cn(messageError && "border-red-400 focus-visible:ring-red-400")}
                />
                <div className="flex items-center justify-between">
                  {messageError ? (
                    <p className="text-xs text-red-400 flex items-center gap-1">
                      <AlertCircle className="h-3 w-3" /> Le message est requis
                    </p>
                  ) : (
                    <span />
                  )}
                  <span className="text-xs text-slate-400">{message.length} / 200</span>
                </div>
              </div>

              {/* Segment */}
              <div className="space-y-2">
                <Label>Segment cible</Label>
                <div className="space-y-2">
                  {[
                    {
                      value: "tous" as Segment,
                      label: "Tous les utilisateurs",
                      desc: "Notification envoyée à tous vos clients actifs",
                      icon: Users,
                    },
                    {
                      value: "inactifs" as Segment,
                      label: "Clients inactifs",
                      desc: "Clients n'ayant pas commandé depuis X jours",
                      icon: Clock,
                    },
                    {
                      value: "zone" as Segment,
                      label: "Zone géographique",
                      desc: "Clients situés dans une zone spécifique",
                      icon: Bell,
                    },
                  ].map((opt) => {
                    const Icon = opt.icon;
                    return (
                      <label
                        key={opt.value}
                        className={cn(
                          "flex items-start gap-3 rounded-xl border p-3 cursor-pointer transition-colors",
                          segment === opt.value
                            ? "border-brand-500 bg-brand-500/10"
                            : "border-slate-200 hover:border-slate-300"
                        )}
                      >
                        <input
                          type="radio"
                          name="segment"
                          value={opt.value}
                          checked={segment === opt.value}
                          onChange={() => setSegment(opt.value)}
                          className="mt-0.5 accent-brand-500"
                        />
                        <Icon
                          className={cn(
                            "h-4 w-4 mt-0.5 shrink-0",
                            segment === opt.value ? "text-brand-400" : "text-slate-400"
                          )}
                        />
                        <div>
                          <p
                            className={cn(
                              "text-sm font-medium",
                              segment === opt.value ? "text-brand-500" : "text-slate-900"
                            )}
                          >
                            {opt.label}
                          </p>
                          <p className="text-xs text-slate-400">{opt.desc}</p>
                        </div>
                      </label>
                    );
                  })}
                </div>

                {/* Extra field for inactifs */}
                {segment === "inactifs" && (
                  <div className="space-y-1.5 pl-2">
                    <Label>Inactifs depuis (jours)</Label>
                    <Input
                      type="number"
                      min={1}
                      max={365}
                      value={inactiveDays}
                      onChange={(e) => setInactiveDays(Number(e.target.value))}
                      className="max-w-[140px]"
                    />
                  </div>
                )}

                {/* Extra field for zone */}
                {segment === "zone" && (
                  <div className="space-y-1.5 pl-2">
                    <Label>Identifiant de zone</Label>
                    <Input
                      placeholder="Ex : yaounde_centre"
                      value={zone}
                      onChange={(e) => setZone(e.target.value)}
                      className="max-w-[240px]"
                    />
                  </div>
                )}
              </div>

              <Button
                className="w-full gap-2"
                onClick={handleSend}
                disabled={sendMutation.isPending}
              >
                <Send className="h-4 w-4" />
                {sendMutation.isPending ? "Envoi en cours…" : "Envoyer la notification"}
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Tips */}
        <Card className="h-fit">
          <CardHeader>
            <CardTitle className="text-base">Conseils</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="rounded-lg bg-brand-500/10 border border-brand-500/20 p-3">
              <p className="text-brand-500 font-medium mb-1">Titre accrocheur</p>
              <p className="text-slate-500 text-xs">Limitez-vous à 50 caractères. Un titre court et percutant augmente le taux d&apos;ouverture.</p>
            </div>
            <div className="rounded-lg bg-blue-500/10 border border-blue-500/20 p-3">
              <p className="text-blue-400 font-medium mb-1">Ciblage intelligent</p>
              <p className="text-slate-500 text-xs">Relancez les clients inactifs avec une offre exclusive pour augmenter la rétention.</p>
            </div>
            <div className="rounded-lg bg-green-500/10 border border-green-500/20 p-3">
              <p className="text-green-400 font-medium mb-1">Fréquence</p>
              <p className="text-slate-500 text-xs">Maximum 2-3 notifications par semaine pour éviter les désabonnements.</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* History */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Bell className="h-4 w-4 text-slate-400" />
            Historique des envois
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Titre</TableHead>
                <TableHead>Message</TableHead>
                <TableHead>Date d&apos;envoi</TableHead>
                <TableHead>Statut</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading
                ? Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      {Array.from({ length: 4 }).map((_, j) => (
                        <TableCell key={j}>
                          <Skeleton className="h-5 w-full" />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                : history.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4}>
                        <div className="flex flex-col items-center justify-center py-10 gap-2 text-slate-400">
                          <Bell className="h-8 w-8 opacity-30" />
                          <p className="text-sm">Aucune notification envoyée</p>
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                : history.map((n) => (
                    <TableRow key={n.id}>
                      <TableCell className="font-medium text-slate-900">{n.title}</TableCell>
                      <TableCell className="text-slate-500 max-w-[300px]">
                        <p className="truncate text-sm">{n.body}</p>
                      </TableCell>
                      <TableCell className="text-xs text-slate-400">
                        {new Date(n.created_at).toLocaleString("fr-FR", {
                          day: "2-digit",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </TableCell>
                      <TableCell>
                        {n.is_sent ? (
                          <Badge
                            variant="outline"
                            className="border-green-500/30 bg-green-500/10 text-green-400 text-xs gap-1"
                          >
                            <CheckCircle2 className="h-3 w-3" /> Envoyée
                          </Badge>
                        ) : (
                          <Badge
                            variant="outline"
                            className="border-amber-500/30 bg-amber-500/10 text-amber-400 text-xs gap-1"
                          >
                            <Clock className="h-3 w-3" /> En attente
                          </Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
