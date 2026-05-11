"use client";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, apiGet } from "@/lib/api";
import { formatDateTime } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/hooks/use-toast";
import {
  Video, Plus, Trash2, Eye, Heart, MessageSquare,
  Play, ExternalLink, CheckCircle2, XCircle,
} from "lucide-react";
import Image from "next/image";

interface Reel {
  id: string;
  caption: string;
  video_url: string;
  thumbnail_url?: string;
  likes_count: number;
  views_count: number;
  is_active: boolean;
  created_at: string;
  product?: { id: string; name: string };
  branch?: { id: string; name: string };
}

interface Comment {
  id: string;
  content: string;
  is_brand_reply: boolean;
  created_at: string;
  user?: { name: string };
  replies?: Comment[];
}

export default function ReelsPage() {
  const qc = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [selectedReel, setSelectedReel] = useState<Reel | null>(null);
  const [replyTarget, setReplyTarget] = useState<Comment | null>(null);
  const [replyText, setReplyText] = useState("");

  const [form, setForm] = useState({
    video_url: "",
    thumbnail_url: "",
    caption: "",
    product_id: "",
    branch_id: "",
  });

  const { data, isLoading } = useQuery<{ data: Reel[] }>({
    queryKey: ["admin-reels"],
    queryFn: () => apiGet("/reels", { limit: 50 }),
    staleTime: 30_000,
  });

  const { data: commentsData, isLoading: commentsLoading } = useQuery<{ data: Comment[] }>({
    queryKey: ["reel-comments", selectedReel?.id],
    queryFn: () => apiGet(`/reels/${selectedReel?.id}/comments`),
    enabled: !!selectedReel,
  });

  const createMutation = useMutation({
    mutationFn: () => api.post("/reels", {
      video_url: form.video_url,
      thumbnail_url: form.thumbnail_url || undefined,
      caption: form.caption,
      product_id: form.product_id || undefined,
      branch_id: form.branch_id || undefined,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-reels"] });
      setShowCreate(false);
      setForm({ video_url: "", thumbnail_url: "", caption: "", product_id: "", branch_id: "" });
      toast.success("Réel publié avec succès");
    },
    onError: (e: any) => toast.error(e?.response?.data?.error?.message ?? "Erreur lors de la publication"),
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, is_active }: { id: string; is_active: boolean }) =>
      api.patch(`/reels/${id}`, { is_active }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-reels"] });
      toast.success("Statut mis à jour");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/reels/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-reels"] });
      toast.success("Réel supprimé");
    },
  });

  const replyMutation = useMutation({
    mutationFn: ({ commentId, content }: { commentId: string; content: string }) =>
      api.post(`/reels/${selectedReel?.id}/comments/${commentId}/reply`, { content }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["reel-comments", selectedReel?.id] });
      setReplyTarget(null);
      setReplyText("");
      toast.success("Réponse publiée");
    },
  });

  const reels = data?.data ?? [];
  const comments = commentsData?.data ?? [];

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Video className="w-6 h-6 text-primary" />
            Réels
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Publiez des vidéos courtes pour promouvoir vos produits
          </p>
        </div>
        <Button onClick={() => setShowCreate(true)} className="gap-2">
          <Plus className="w-4 h-4" />
          Nouveau réel
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
              <Video className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold">{reels.length}</p>
              <p className="text-xs text-muted-foreground">Réels publiés</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-pink-100 flex items-center justify-center">
              <Heart className="w-5 h-5 text-pink-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{reels.reduce((s, r) => s + r.likes_count, 0)}</p>
              <p className="text-xs text-muted-foreground">J'aime total</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
              <Eye className="w-5 h-5 text-blue-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{reels.reduce((s, r) => s + r.views_count, 0)}</p>
              <p className="text-xs text-muted-foreground">Vues total</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Reels grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1,2,3].map((k) => <Skeleton key={k} className="h-64 rounded-xl" />)}
        </div>
      ) : reels.length === 0 ? (
        <Card>
          <CardContent className="py-20 flex flex-col items-center gap-3 text-center">
            <Video className="w-12 h-12 text-muted-foreground" />
            <p className="text-lg font-semibold">Aucun réel publié</p>
            <p className="text-sm text-muted-foreground">Publiez votre premier réel pour engager vos clients</p>
            <Button onClick={() => setShowCreate(true)} className="mt-2 gap-2">
              <Plus className="w-4 h-4" />Créer un réel
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {reels.map((r) => (
            <Card key={r.id} className="overflow-hidden">
              {/* Thumbnail */}
              <div className="relative h-48 bg-gray-900 flex items-center justify-center">
                {r.thumbnail_url ? (
                  <Image src={r.thumbnail_url} alt={r.caption} fill className="object-cover opacity-80" />
                ) : (
                  <Play className="w-12 h-12 text-white/50" />
                )}
                <div className="absolute top-2 right-2">
                  <Badge variant={r.is_active ? "default" : "secondary"} className="gap-1">
                    {r.is_active ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                    {r.is_active ? "Actif" : "Inactif"}
                  </Badge>
                </div>
                <a href={r.video_url} target="_blank" rel="noreferrer"
                  className="absolute bottom-2 right-2 bg-white/20 backdrop-blur-sm rounded-full p-2 hover:bg-white/30 transition">
                  <ExternalLink className="w-4 h-4 text-white" />
                </a>
              </div>

              <CardContent className="p-4 space-y-3">
                <p className="text-sm font-semibold line-clamp-2">{r.caption}</p>
                {r.product && (
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    🛒 {r.product.name}
                  </p>
                )}
                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1"><Heart className="w-3 h-3" />{r.likes_count}</span>
                  <span className="flex items-center gap-1"><Eye className="w-3 h-3" />{r.views_count}</span>
                  <span className="flex items-center gap-1 cursor-pointer hover:text-primary" onClick={() => setSelectedReel(r)}>
                    <MessageSquare className="w-3 h-3" />Commentaires
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">{formatDateTime(r.created_at)}</p>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" className="flex-1"
                    onClick={() => toggleMutation.mutate({ id: r.id, is_active: !r.is_active })}
                    disabled={toggleMutation.isPending}
                  >
                    {r.is_active ? "Désactiver" : "Activer"}
                  </Button>
                  <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive"
                    onClick={() => deleteMutation.mutate(r.id)}
                    disabled={deleteMutation.isPending}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Publier un nouveau réel</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>URL de la vidéo *</Label>
              <Input placeholder="https://..." value={form.video_url} onChange={(e) => setForm({ ...form, video_url: e.target.value })} />
              <p className="text-xs text-muted-foreground mt-1">Lien Cloudinary, S3, ou autre hébergeur vidéo</p>
            </div>
            <div>
              <Label>Vignette (thumbnail)</Label>
              <Input placeholder="https://..." value={form.thumbnail_url} onChange={(e) => setForm({ ...form, thumbnail_url: e.target.value })} />
            </div>
            <div>
              <Label>Légende *</Label>
              <Textarea
                placeholder="Décrivez votre vidéo…"
                value={form.caption}
                onChange={(e) => setForm({ ...form, caption: e.target.value })}
                rows={3}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>ID Produit (optionnel)</Label>
                <Input placeholder="uuid..." value={form.product_id} onChange={(e) => setForm({ ...form, product_id: e.target.value })} />
              </div>
              <div>
                <Label>ID Branche (optionnel)</Label>
                <Input placeholder="uuid..." value={form.branch_id} onChange={(e) => setForm({ ...form, branch_id: e.target.value })} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>Annuler</Button>
            <Button
              onClick={() => createMutation.mutate()}
              disabled={!form.video_url || !form.caption || createMutation.isPending}
            >
              {createMutation.isPending ? "Publication…" : "Publier"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Comments panel */}
      <Dialog open={!!selectedReel} onOpenChange={(o) => { if (!o) setSelectedReel(null); }}>
        <DialogContent className="max-w-lg max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageSquare className="w-5 h-5" />
              Commentaires — {selectedReel?.caption?.slice(0, 40)}…
            </DialogTitle>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto space-y-4 py-2">
            {commentsLoading ? (
              <div className="space-y-3">{[1,2,3].map((k) => <Skeleton key={k} className="h-16 rounded-lg" />)}</div>
            ) : comments.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-40" />
                <p>Aucun commentaire pour l'instant</p>
              </div>
            ) : comments.map((c) => (
              <div key={c.id} className="space-y-2">
                <div className="flex gap-3">
                  <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-xs font-bold shrink-0">
                    {c.user?.name?.charAt(0) ?? "?"}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold">{c.user?.name ?? "Utilisateur"}</p>
                      <p className="text-xs text-muted-foreground">{formatDateTime(c.created_at)}</p>
                    </div>
                    <p className="text-sm mt-0.5">{c.content}</p>
                    <Button size="sm" variant="ghost" className="h-6 px-2 text-xs mt-1 text-primary"
                      onClick={() => { setReplyTarget(c); setReplyText(""); }}
                    >
                      Répondre
                    </Button>
                  </div>
                </div>

                {/* Brand replies */}
                {c.replies?.map((r) => (
                  <div key={r.id} className="ml-11 flex gap-3">
                    <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      🏪
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-primary">Vous (marque)</p>
                      <p className="text-sm mt-0.5">{r.content}</p>
                    </div>
                  </div>
                ))}

                {/* Reply input */}
                {replyTarget?.id === c.id && (
                  <div className="ml-11 flex gap-2">
                    <Input
                      placeholder="Votre réponse…"
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey && replyText.trim()) {
                          e.preventDefault();
                          replyMutation.mutate({ commentId: c.id, content: replyText.trim() });
                        }
                      }}
                      className="flex-1 h-8 text-sm"
                    />
                    <Button size="sm" className="h-8 px-3"
                      disabled={!replyText.trim() || replyMutation.isPending}
                      onClick={() => replyMutation.mutate({ commentId: c.id, content: replyText.trim() })}
                    >
                      {replyMutation.isPending ? "…" : "Envoyer"}
                    </Button>
                    <Button size="sm" variant="ghost" className="h-8" onClick={() => setReplyTarget(null)}>✕</Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
