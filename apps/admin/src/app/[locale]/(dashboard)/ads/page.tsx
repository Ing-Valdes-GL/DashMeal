"use client";
import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { use } from "react";
import { api } from "@/lib/api";
import { apiGet } from "@/lib/api";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";
import {
  Megaphone, Plus, Trash2, Clock, TrendingUp,
  Upload, X, Users, Banknote, Eye, Smartphone, CheckCircle2, XCircle, Circle,
} from "lucide-react";
import Image from "next/image";

interface Ad {
  id: string; title: string; image_url: string; target_count: number;
  amount_paid: number; status: string; impressions_count: number;
  rejection_reason: string | null; created_at: string; activated_at: string | null;
}

interface PaymentInfo {
  reference: string;
  ussd_code: string | null;
  operator: string | null;
  amount: number;
}

type StepStatus = "idle" | "loading" | "done" | "error";
interface Step { label: string; status: StepStatus; error?: string }

const STATUS_BADGE: Record<string, { variant: any; label: string }> = {
  pending:  { variant: "pending",   label: "En attente" },
  approved: { variant: "confirmed", label: "Approuvée" },
  active:   { variant: "delivered", label: "Active" },
  expired:  { variant: "default",   label: "Expirée" },
  rejected: { variant: "cancelled", label: "Rejetée" },
};

const PRICE_PER_UNIT = 10;
const USERS_PER_UNIT = 6;
const calcPrice = (n: number) => Math.ceil(n / USERS_PER_UNIT) * PRICE_PER_UNIT;

const PAYMENT_METHODS = [
  { value: "orange_money",     label: "Orange Money" },
  { value: "mtn_mobile_money", label: "MTN MoMo" },
];

export default function AdsPage({ params }: { params: Promise<{ locale: string }> }) {
  use(params);
  const qc = useQueryClient();

  // Création
  const [open, setOpen] = useState(false);
  const [title, setTitle]           = useState("");
  const [target, setTarget]         = useState(60);
  const [file, setFile]             = useState<File | null>(null);
  const [preview, setPreview]       = useState<string | null>(null);
  const [phone, setPhone]           = useState("");
  const [method, setMethod]         = useState("orange_money");
  const fileRef = useRef<HTMLInputElement>(null);

  // Paiement Campay
  const [paymentInfo, setPaymentInfo] = useState<PaymentInfo | null>(null);
  const [payStatus, setPayStatus]     = useState<"pending" | "paid" | "failed">("pending");
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const INIT_STEPS: Step[] = [
    { label: "Upload de l'image", status: "idle" },
    { label: "Initiation du paiement — vous allez recevoir un USSD, remplissez votre code PIN", status: "idle" },
    { label: "Enregistrement de la campagne", status: "idle" },
    { label: "Confirmation & crédit wallet plateforme", status: "idle" },
  ];
  const [steps, setSteps] = useState<Step[]>(INIT_STEPS);
  const [showSteps, setShowSteps] = useState(false);

  const setStep = (i: number, s: Partial<Step>) =>
    setSteps((prev) => prev.map((st, idx) => idx === i ? { ...st, ...s } : st));

  const { data: ads, isLoading } = useQuery<Ad[]>({
    queryKey: ["my-ads"],
    queryFn: () => apiGet("/ads"),
  });

  // Initier le paiement
  const initiateMutation = useMutation({
    mutationFn: async () => {
      if (!file) throw new Error("Image requise");

      setSteps(INIT_STEPS);
      setShowSteps(true);

      // Étape 1 — upload image (fait côté backend, on simule le loading)
      setStep(0, { status: "loading" });
      const form = new FormData();
      form.append("image",          file);
      form.append("title",          title);
      form.append("target_count",   String(target));
      form.append("payment_phone",  phone);
      form.append("payment_method", method);

      let res;
      try {
        // Le backend fait : upload image → Campay → INSERT ad_payment_intents
        // On reçoit l'erreur précise si quelque chose plante
        setStep(0, { status: "done" });
        setStep(1, { status: "loading" });
        res = await api.post("/ads", form, { headers: { "Content-Type": "multipart/form-data" } });
        setStep(1, { status: "done" });
        setStep(2, { status: "done" });
      } catch (err: any) {
        const msg = err?.response?.data?.error?.message ?? err?.message ?? "Erreur inconnue";
        // Déterminer quelle étape a échoué selon le code d'erreur
        const code = err?.response?.data?.error?.code ?? "";
        if (code === "UPLOAD_ERROR" || code === "MISSING_IMAGE") {
          setStep(0, { status: "error", error: msg });
        } else if (code === "CAMPAY_ERROR" || code === "AMOUNT_TOO_LOW") {
          setStep(0, { status: "done" });
          setStep(1, { status: "error", error: msg });
        } else {
          setStep(0, { status: "done" });
          setStep(1, { status: "done" });
          setStep(2, { status: "error", error: msg });
        }
        throw err;
      }

      return res.data.data as PaymentInfo;
    },
    onSuccess: (info) => {
      setPaymentInfo(info);
      setPayStatus("pending");
      setOpen(false);
      setShowSteps(false);
      startPolling(info.reference);
    },
    onError: (e: any) => {
      // L'erreur est affichée dans le stepper — pas de toast générique
    },
  });

  function startPolling(reference: string) {
    if (pollingRef.current) clearInterval(pollingRef.current);
    setStep(3, { status: "loading" });
    pollingRef.current = setInterval(async () => {
      try {
        const res = await api.get(`/ads/payment/${reference}/status`);
        const s = res.data.data?.status as string;
        if (s === "paid") {
          clearInterval(pollingRef.current!);
          setStep(3, { status: "done" });
          setPayStatus("paid");
          qc.invalidateQueries({ queryKey: ["my-ads"] });
        } else if (s === "failed") {
          clearInterval(pollingRef.current!);
          setStep(3, { status: "error", error: "Paiement refusé ou expiré" });
          setPayStatus("failed");
        }
      } catch (e: any) {
        const msg = e?.response?.data?.error?.message ?? "";
        if (msg) setStep(3, { status: "error", error: msg });
      }
    }, 3000);
  }

  useEffect(() => () => { if (pollingRef.current) clearInterval(pollingRef.current); }, []);

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/ads/${id}`),
    onSuccess: () => { toast.success("Publicité supprimée"); qc.invalidateQueries({ queryKey: ["my-ads"] }); },
    onError: (e: any) => toast.error(e?.response?.data?.error?.message ?? "Erreur"),
  });

  const resetForm = () => {
    setTitle(""); setTarget(60); setFile(null); setPreview(null); setPhone(""); setMethod("orange_money");
    setSteps(INIT_STEPS); setShowSteps(false);
  };
  const closePaymentModal = () => {
    if (pollingRef.current) clearInterval(pollingRef.current);
    setPaymentInfo(null); setPayStatus("pending");
    if (payStatus !== "paid") resetForm();
  };
  const handleFile = (f: File) => { setFile(f); setPreview(URL.createObjectURL(f)); };

  const price = calcPrice(target);
  const activeAds  = ads?.filter((a) => a.status === "active")  ?? [];
  const pendingAds = ads?.filter((a) => a.status === "pending") ?? [];
  const totalSpent = ads?.reduce((s, a) => s + Number(a.amount_paid), 0) ?? 0;
  const totalReach = ads?.filter((a) => ["active","expired"].includes(a.status))
                        .reduce((s, a) => s + a.impressions_count, 0) ?? 0;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Megaphone className="h-6 w-6 text-brand-600" /> Publicités
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {PRICE_PER_UNIT} FCFA pour {USERS_PER_UNIT} utilisateurs — paiement Mobile Money
          </p>
        </div>
        <Button onClick={() => setOpen(true)} className="gap-2">
          <Plus className="h-4 w-4" /> Nouvelle publicité
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: "Pubs actives",        value: activeAds.length,       icon: TrendingUp, color: "text-green-600",  bg: "bg-green-50 border-green-100" },
          { label: "En attente",           value: pendingAds.length,      icon: Clock,      color: "text-yellow-600", bg: "bg-yellow-50 border-yellow-100" },
          { label: "Total dépensé",        value: formatCurrency(totalSpent), icon: Banknote, color: "text-brand-600", bg: "bg-brand-50 border-brand-100" },
          { label: "Utilisateurs touchés", value: totalReach,             icon: Eye,        color: "text-blue-600",   bg: "bg-blue-50 border-blue-100" },
        ].map((s) => {
          const Icon = s.icon;
          return (
            <Card key={s.label} className={`border ${s.bg}`}>
              <CardContent className="p-4 flex items-center gap-3">
                <div className={`rounded-lg p-2 ${s.bg} border`}>
                  <Icon className={`h-4 w-4 ${s.color}`} />
                </div>
                <div>
                  <p className="text-xs text-slate-500 font-medium">{s.label}</p>
                  <p className="text-lg font-bold text-slate-900">{s.value}</p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Liste */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold text-slate-700">Mes publicités</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-5 space-y-3">{[1,2,3].map((i) => <Skeleton key={i} className="h-20 w-full" />)}</div>
          ) : !ads?.length ? (
            <div className="flex flex-col items-center justify-center py-16 text-slate-400">
              <Megaphone className="h-10 w-10 mb-3 opacity-30" />
              <p className="font-medium text-slate-600">Aucune publicité</p>
              <p className="text-sm mt-1">Créez votre première pub pour atteindre vos clients</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {ads.map((ad) => {
                const s = STATUS_BADGE[ad.status] ?? STATUS_BADGE.pending;
                const progress = Math.min(100, Math.round((ad.impressions_count / ad.target_count) * 100));
                return (
                  <div key={ad.id} className="flex items-center gap-4 px-5 py-4 hover:bg-slate-50 transition-colors">
                    <div className="h-16 w-24 shrink-0 rounded-lg overflow-hidden bg-slate-100 border border-slate-200">
                      <Image src={ad.image_url} alt={ad.title} width={96} height={64} className="h-full w-full object-cover" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-semibold text-slate-900 truncate">{ad.title}</p>
                        <Badge variant={s.variant}>{s.label}</Badge>
                      </div>
                      <div className="flex items-center gap-4 text-xs text-slate-500 mb-2">
                        <span className="flex items-center gap-1"><Users className="h-3 w-3" />{ad.impressions_count}/{ad.target_count}</span>
                        <span className="flex items-center gap-1"><Banknote className="h-3 w-3" />{formatCurrency(ad.amount_paid)}</span>
                        <span>{formatDateTime(ad.created_at)}</span>
                      </div>
                      {["active","expired"].includes(ad.status) && (
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                            <div className="h-full bg-brand-500 rounded-full transition-all" style={{ width: `${progress}%` }} />
                          </div>
                          <span className="text-xs text-slate-400 shrink-0">{progress}%</span>
                        </div>
                      )}
                      {ad.status === "rejected" && ad.rejection_reason && (
                        <p className="text-xs text-red-600 mt-1">Motif : {ad.rejection_reason}</p>
                      )}
                    </div>
                    {["pending","rejected","expired"].includes(ad.status) && (
                      <Button variant="ghost" size="icon-sm"
                        className="shrink-0 text-slate-400 hover:text-red-600 hover:bg-red-50"
                        onClick={() => deleteMutation.mutate(ad.id)}
                        disabled={deleteMutation.isPending}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ─── Modale : formulaire création ──────────────────────────────────── */}
      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm(); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Nouvelle publicité</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {/* Titre */}
            <div className="space-y-1.5">
              <Label>Titre de la publicité</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex: Promo weekend -20%" />
            </div>

            {/* Image */}
            <div className="space-y-1.5">
              <Label>Image ou GIF <span className="text-slate-400 font-normal">(JPG, PNG, WEBP, GIF — max 10 Mo)</span></Label>
              {preview ? (
                <div className="relative rounded-lg overflow-hidden border border-slate-200 bg-slate-50">
                  <img src={preview} alt="preview" className="w-full h-36 object-cover" />
                  <button type="button" onClick={() => { setFile(null); setPreview(null); }}
                    className="absolute top-2 right-2 h-7 w-7 rounded-full bg-black/50 flex items-center justify-center text-white hover:bg-black/70">
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ) : (
                <div onClick={() => fileRef.current?.click()}
                  className="flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-slate-200 bg-slate-50 py-7 cursor-pointer hover:border-brand-300 hover:bg-brand-50/40 transition-colors">
                  <Upload className="h-6 w-6 text-slate-400" />
                  <p className="text-sm text-slate-500"><span className="text-brand-600 font-medium">Choisir</span> ou glisser-déposer</p>
                </div>
              )}
              <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ""; }} />
            </div>

            {/* Audience */}
            <div className="space-y-1.5">
              <Label>Utilisateurs à atteindre</Label>
              <div className="flex gap-2">
                {[6, 30, 60, 120, 300].map((n) => (
                  <button key={n} type="button" onClick={() => setTarget(n)}
                    className={`flex-1 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                      target === n ? "bg-brand-600 text-white border-brand-600" : "border-slate-200 text-slate-600 hover:border-brand-300"}`}>
                    {n}
                  </button>
                ))}
              </div>
              <Input type="number" min={6} step={6} value={target}
                onChange={(e) => setTarget(Math.max(6, parseInt(e.target.value) || 6))} className="mt-1" />
            </div>

            {/* Paiement */}
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1.5"><Smartphone className="h-3.5 w-3.5" /> Paiement Mobile Money</Label>
              <div className="flex gap-2">
                {PAYMENT_METHODS.map((m) => (
                  <button key={m.value} type="button" onClick={() => setMethod(m.value)}
                    className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${
                      method === m.value ? "bg-brand-600 text-white border-brand-600" : "border-slate-200 text-slate-600 hover:border-brand-300"}`}>
                    {m.label}
                  </button>
                ))}
              </div>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)}
                placeholder="+237 6XX XXX XXX" type="tel" />
            </div>

            {/* Prix */}
            <div className="rounded-xl bg-brand-50 border border-brand-100 p-4 flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-brand-700">Coût de la campagne</p>
                <p className="text-xs text-brand-500 mt-0.5">{target} utilisateurs × {PRICE_PER_UNIT} FCFA/{USERS_PER_UNIT}</p>
              </div>
              <p className="text-2xl font-bold text-brand-700">{formatCurrency(price)}</p>
            </div>
            <p className="text-xs text-slate-400 text-center">
              Un push USSD sera envoyé sur votre téléphone. Confirmez avec votre PIN Mobile Money.
            </p>
          </div>
          {/* Vérificateur d'état */}
          {showSteps && (
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 space-y-2">
              {steps.map((st, i) => (
                <div key={i} className="flex items-start gap-2.5">
                  <div className="mt-0.5 shrink-0">
                    {st.status === "idle"    && <Circle className="h-4 w-4 text-slate-300" />}
                    {st.status === "loading" && <Spinner size="sm" />}
                    {st.status === "done"    && <CheckCircle2 className="h-4 w-4 text-green-500" />}
                    {st.status === "error"   && <XCircle className="h-4 w-4 text-red-500" />}
                  </div>
                  <div className="min-w-0">
                    <p className={`text-sm font-medium ${
                      st.status === "error" ? "text-red-600" :
                      st.status === "done"  ? "text-green-700" :
                      st.status === "loading" ? "text-slate-900" : "text-slate-400"
                    }`}>{st.label}</p>
                    {st.error && (
                      <p className="text-xs text-red-500 mt-0.5 break-words">{st.error}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => { setOpen(false); resetForm(); }}>Annuler</Button>
            <Button onClick={() => initiateMutation.mutate()}
              disabled={!title.trim() || !file || !phone.trim() || initiateMutation.isPending}>
              {initiateMutation.isPending ? <><Spinner size="sm" /> En cours…</> : `Payer ${formatCurrency(price)}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Modale : attente paiement Campay ──────────────────────────────── */}
      <Dialog open={!!paymentInfo} onOpenChange={(v) => { if (!v) closePaymentModal(); }}>
        <DialogContent className="max-w-sm text-center">
          <DialogHeader>
            <DialogTitle>
              {payStatus === "paid"   ? "Paiement confirmé !" :
               payStatus === "failed" ? "Paiement échoué" :
               "En attente de paiement"}
            </DialogTitle>
          </DialogHeader>
          <div className="py-6 space-y-4">
            {payStatus === "pending" && (
              <>
                <div className="flex justify-center">
                  <div className="relative h-16 w-16">
                    <Spinner size="lg" className="absolute inset-0" />
                    <Smartphone className="absolute inset-0 m-auto h-6 w-6 text-brand-600" />
                  </div>
                </div>
                {paymentInfo?.ussd_code && (
                  <div className="rounded-xl bg-slate-50 border border-slate-200 p-4">
                    <p className="text-xs text-slate-500 mb-1">Code USSD manuel</p>
                    <p className="text-xl font-mono font-bold text-slate-900 tracking-widest">{paymentInfo.ussd_code}</p>
                  </div>
                )}
                <p className="text-sm text-slate-600">
                  Un push USSD a été envoyé sur <span className="font-semibold">{paymentInfo?.operator ?? "votre téléphone"}</span>.
                  Confirmez le paiement de <span className="font-semibold text-brand-700">{formatCurrency(paymentInfo?.amount ?? 0)}</span> avec votre PIN.
                </p>
                <p className="text-xs text-slate-400">Cette page se met à jour automatiquement…</p>
              </>
            )}
            {payStatus === "paid" && (
              <>
                <CheckCircle2 className="h-14 w-14 text-green-500 mx-auto" />
                <p className="text-sm text-slate-600">Votre pub est soumise et sera visible après validation par notre équipe.</p>
              </>
            )}
            {payStatus === "failed" && (
              <>
                <XCircle className="h-14 w-14 text-red-500 mx-auto" />
                <p className="text-sm text-slate-600">Le paiement n&apos;a pas abouti. Vous pouvez réessayer.</p>
              </>
            )}
          </div>
          <DialogFooter>
            {payStatus === "pending" ? (
              <Button variant="outline" onClick={closePaymentModal} className="w-full">Annuler</Button>
            ) : (
              <Button onClick={closePaymentModal} className="w-full">Fermer</Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
