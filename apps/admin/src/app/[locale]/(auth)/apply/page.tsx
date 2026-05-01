"use client";

import Link from "next/link";
import { use, useState, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { AxiosError } from "axios";
import { api } from "@/lib/api";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import {
  CheckCircle2, Store, Mail, Phone, MapPin, User, Lock,
  ChevronLeft, Upload, X, FileText, ImageIcon, AlertCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";

const ApplySchema = z.object({
  brand_name:    z.string().min(2, "Nom de la marque requis (min 2 caractères)"),
  contact_name:  z.string().min(2, "Nom du responsable requis"),
  contact_email: z.string().email("Email invalide"),
  contact_phone: z.string().regex(/^\+?[1-9]\d{7,14}$/, "Ex: +237600000000"),
  city:          z.string().min(2, "Ville requise"),
  description:   z.string().min(20, "Min 20 caractères").max(500),
  password:      z.string().min(8, "Minimum 8 caractères"),
});
type ApplyData = z.infer<typeof ApplySchema>;

type DocSlot = {
  key: "logo" | "niu" | "rccm" | "other";
  label: string;
  hint: string;
  accept: string;
  icon: React.ReactNode;
  required: boolean;
};

const DOC_SLOTS: DocSlot[] = [
  {
    key: "logo",
    label: "Logo de la marque",
    hint: "JPG, PNG ou WEBP — max 5 Mo",
    accept: "image/jpeg,image/png,image/webp",
    icon: <ImageIcon className="h-5 w-5" />,
    required: false,
  },
  {
    key: "niu",
    label: "NIU (Numéro d'Identifiant Unique)",
    hint: "PDF ou image — max 10 Mo",
    accept: "image/jpeg,image/png,image/webp,application/pdf",
    icon: <FileText className="h-5 w-5" />,
    required: false,
  },
  {
    key: "rccm",
    label: "RCCM / Registre du commerce",
    hint: "PDF ou image — max 10 Mo",
    accept: "image/jpeg,image/png,image/webp,application/pdf",
    icon: <FileText className="h-5 w-5" />,
    required: false,
  },
  {
    key: "other",
    label: "Photos du restaurant / autres",
    hint: "JPG, PNG, WEBP ou PDF — max 10 Mo",
    accept: "image/jpeg,image/png,image/webp,application/pdf",
    icon: <ImageIcon className="h-5 w-5" />,
    required: false,
  },
];

function DashMealLogo({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="40" height="40" rx="10" fill="#16a34a" />
      <path d="M20 8C13.373 8 8 13.373 8 20s5.373 12 12 12 12-5.373 12-12S26.627 8 20 8z" fill="#22c55e" opacity="0.4" />
      <path d="M14 16h2v10h-2V16zm4-2h2v14h-2V14zm4 4h2v10h-2V18zm4-3h2v13h-2V15z" fill="white" />
      <circle cx="30" cy="12" r="4" fill="#eab308" />
      <path d="M29 11l1 1 2-2" stroke="white" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function FileDropZone({
  slot,
  file,
  onSelect,
  onRemove,
  uploading,
  uploaded,
  error,
}: {
  slot: DocSlot;
  file: File | null;
  onSelect: (f: File) => void;
  onRemove: () => void;
  uploading: boolean;
  uploaded: boolean;
  error: string | null;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDrag(false);
    const dropped = e.dataTransfer.files[0];
    if (dropped) onSelect(dropped);
  };

  const isPdf = file?.type === "application/pdf";

  return (
    <div className="space-y-1.5">
      <Label className="flex items-center gap-1.5 text-slate-700">
        {slot.icon}
        {slot.label}
        {slot.required && <span className="text-red-500 ml-0.5">*</span>}
      </Label>

      {file ? (
        <div className={cn(
          "flex items-center gap-3 rounded-lg border px-3 py-2.5 text-sm",
          uploaded ? "border-brand-200 bg-brand-50" : "border-slate-200 bg-slate-50",
          error && "border-red-200 bg-red-50"
        )}>
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-white border border-slate-200 text-slate-500">
            {isPdf ? <FileText className="h-4 w-4 text-red-500" /> : <ImageIcon className="h-4 w-4 text-blue-500" />}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-medium text-slate-800 truncate">{file.name}</p>
            <p className="text-xs text-slate-400">{(file.size / 1024 / 1024).toFixed(2)} Mo</p>
          </div>
          {uploading && <Spinner size="sm" />}
          {uploaded && !uploading && <CheckCircle2 className="h-4 w-4 text-brand-600 shrink-0" />}
          {error && <AlertCircle className="h-4 w-4 text-red-500 shrink-0" />}
          {!uploading && (
            <button type="button" onClick={onRemove} className="text-slate-400 hover:text-slate-700 shrink-0">
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      ) : (
        <div
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
          onDragLeave={() => setDrag(false)}
          onDrop={handleDrop}
          className={cn(
            "flex flex-col items-center justify-center gap-1.5 rounded-lg border-2 border-dashed px-4 py-5 cursor-pointer transition-colors",
            drag
              ? "border-brand-400 bg-brand-50"
              : "border-slate-200 bg-slate-50 hover:border-brand-300 hover:bg-brand-50/50"
          )}
        >
          <Upload className={cn("h-5 w-5", drag ? "text-brand-500" : "text-slate-400")} />
          <p className="text-sm text-slate-600">
            <span className="font-medium text-brand-600">Choisir un fichier</span> ou glisser-déposer
          </p>
          <p className="text-xs text-slate-400">{slot.hint}</p>
        </div>
      )}

      {error && <p className="text-xs text-red-600 flex items-center gap-1"><AlertCircle className="h-3 w-3" />{error}</p>}

      <input
        ref={inputRef}
        type="file"
        accept={slot.accept}
        className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) onSelect(f); e.target.value = ""; }}
      />
    </div>
  );
}

type FileState = {
  file: File | null;
  uploading: boolean;
  uploaded: boolean;
  error: string | null;
};

export default function ApplyPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = use(params);
  const [submitted, setSubmitted] = useState(false);
  const [step, setStep] = useState<"form" | "uploading">("form");
  const [uploadProgress, setUploadProgress] = useState(0);

  const [files, setFiles] = useState<Record<string, FileState>>({
    logo:  { file: null, uploading: false, uploaded: false, error: null },
    niu:   { file: null, uploading: false, uploaded: false, error: null },
    rccm:  { file: null, uploading: false, uploaded: false, error: null },
    other: { file: null, uploading: false, uploaded: false, error: null },
  });

  const setFile = (key: string, file: File | null) => {
    setFiles((prev) => ({ ...prev, [key]: { file, uploading: false, uploaded: false, error: null } }));
  };

  const setFileState = (key: string, patch: Partial<FileState>) => {
    setFiles((prev) => ({ ...prev, [key]: { ...prev[key], ...patch } }));
  };

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ApplyData>({ resolver: zodResolver(ApplySchema) });

  const onSubmit = async (data: ApplyData) => {
    // Étape 1 : créer la demande
    let applicationId: string;
    try {
      const res = await api.post<{ success: true; data: { application: { id: string } } }>("/auth/apply", data);
      applicationId = res.data.data.application.id;
    } catch (error) {
      const message =
        error instanceof AxiosError
          ? (error.response?.data as { error?: { message?: string } })?.error?.message
          : undefined;
      toast.error(message ?? "Une erreur est survenue. Veuillez réessayer.");
      return;
    }

    // Étape 2 : uploader les fichiers sélectionnés
    const selectedSlots = DOC_SLOTS.filter((s) => files[s.key].file !== null);

    if (selectedSlots.length === 0) {
      setSubmitted(true);
      return;
    }

    setStep("uploading");
    let done = 0;

    await Promise.allSettled(
      selectedSlots.map(async (slot) => {
        setFileState(slot.key, { uploading: true });
        try {
          const form = new FormData();
          form.append("file", files[slot.key].file!);
          form.append("application_id", applicationId);
          form.append("doc_type", slot.key);
          await api.post("/documents/upload", form, {
            headers: { "Content-Type": "multipart/form-data" },
          });
          setFileState(slot.key, { uploading: false, uploaded: true });
        } catch {
          setFileState(slot.key, { uploading: false, error: "Échec de l'envoi" });
        } finally {
          done++;
          setUploadProgress(Math.round((done / selectedSlots.length) * 100));
        }
      })
    );

    setSubmitted(true);
  };

  if (submitted) {
    return (
      <div className="mx-auto max-w-md w-full text-center">
        <div className="flex justify-center mb-6">
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-brand-50 border-2 border-brand-200">
            <CheckCircle2 className="h-10 w-10 text-brand-600" />
          </div>
        </div>
        <h1 className="text-2xl font-bold text-slate-900 mb-2">Demande envoyée !</h1>
        <p className="text-slate-500 mb-6">
          Votre demande d&apos;accès à Dash Meal a bien été reçue. Notre équipe vous contactera dans les 24-48h ouvrables.
        </p>
        <div className="bg-brand-50 border border-brand-100 rounded-xl p-4 mb-6 text-left">
          <p className="text-sm font-semibold text-brand-700 mb-1">Prochaines étapes</p>
          <ul className="text-sm text-brand-600 space-y-1">
            <li>✓ Vérification de vos informations et documents</li>
            <li>✓ Activation de votre espace marque</li>
            <li>✓ Email de confirmation avec vos identifiants</li>
          </ul>
        </div>
        <Link href={`/${locale}/login`}>
          <Button className="w-full">Se connecter</Button>
        </Link>
      </div>
    );
  }

  const isLoading = isSubmitting || step === "uploading";

  return (
    <div className="mx-auto max-w-xl w-full">
      <div className="flex flex-col items-center mb-8">
        <DashMealLogo className="h-12 w-12 mb-3" />
        <h1 className="text-2xl font-bold text-slate-900">Rejoignez Dash Meal</h1>
        <p className="mt-1 text-sm text-slate-500 text-center max-w-sm">
          Remplissez ce formulaire pour déposer votre demande d&apos;accès à la plateforme.
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {/* ─── Informations générales ──────────────────────────── */}
        <Card className="border-slate-200 bg-white shadow-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-base text-slate-800">Informations de votre marque</CardTitle>
            <CardDescription>Toutes les informations seront vérifiées par notre équipe.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="brand_name" className="flex items-center gap-1.5 text-slate-700">
                <Store className="h-3.5 w-3.5 text-slate-400" /> Nom de la marque / restaurant
              </Label>
              <Input id="brand_name" placeholder="Ex: Délices du Cameroun" {...register("brand_name")} />
              {errors.brand_name && <p className="text-xs text-red-600">{errors.brand_name.message}</p>}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="contact_name" className="flex items-center gap-1.5 text-slate-700">
                <User className="h-3.5 w-3.5 text-slate-400" /> Nom du responsable
              </Label>
              <Input id="contact_name" placeholder="Ex: Jean Dupont" {...register("contact_name")} />
              {errors.contact_name && <p className="text-xs text-red-600">{errors.contact_name.message}</p>}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="contact_email" className="flex items-center gap-1.5 text-slate-700">
                  <Mail className="h-3.5 w-3.5 text-slate-400" /> Email
                </Label>
                <Input id="contact_email" type="email" placeholder="restaurant@email.com" {...register("contact_email")} />
                {errors.contact_email && <p className="text-xs text-red-600">{errors.contact_email.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="contact_phone" className="flex items-center gap-1.5 text-slate-700">
                  <Phone className="h-3.5 w-3.5 text-slate-400" /> Téléphone
                </Label>
                <Input id="contact_phone" type="tel" placeholder="+237 6XX XXX XXX" {...register("contact_phone")} />
                {errors.contact_phone && <p className="text-xs text-red-600">{errors.contact_phone.message}</p>}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="city" className="flex items-center gap-1.5 text-slate-700">
                <MapPin className="h-3.5 w-3.5 text-slate-400" /> Ville
              </Label>
              <Input id="city" placeholder="Ex: Yaoundé, Douala, Libreville..." {...register("city")} />
              {errors.city && <p className="text-xs text-red-600">{errors.city.message}</p>}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="description" className="text-slate-700">Décrivez votre activité</Label>
              <textarea
                id="description"
                rows={3}
                placeholder="Type de cuisine, nombre d'agences, zone de livraison..."
                {...register("description")}
                className="flex w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand-500 focus-visible:border-brand-500 resize-none"
              />
              {errors.description && <p className="text-xs text-red-600">{errors.description.message}</p>}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password" className="flex items-center gap-1.5 text-slate-700">
                <Lock className="h-3.5 w-3.5 text-slate-400" /> Choisissez un mot de passe
              </Label>
              <Input id="password" type="password" placeholder="Minimum 8 caractères" {...register("password")} />
              {errors.password && <p className="text-xs text-red-600">{errors.password.message}</p>}
            </div>
          </CardContent>
        </Card>

        {/* ─── Documents & photos ──────────────────────────────── */}
        <Card className="border-slate-200 bg-white shadow-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-base text-slate-800">Documents & photos</CardTitle>
            <CardDescription>
              Facultatifs mais recommandés — accélèrent la validation de votre dossier.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {DOC_SLOTS.map((slot) => (
              <FileDropZone
                key={slot.key}
                slot={slot}
                file={files[slot.key].file}
                uploading={files[slot.key].uploading}
                uploaded={files[slot.key].uploaded}
                error={files[slot.key].error}
                onSelect={(f) => setFile(slot.key, f)}
                onRemove={() => setFile(slot.key, null)}
              />
            ))}
          </CardContent>
        </Card>

        {/* ─── Progress bar during upload ───────────────────────── */}
        {step === "uploading" && (
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs text-slate-500">
              <span>Envoi des fichiers en cours…</span>
              <span>{uploadProgress}%</span>
            </div>
            <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-brand-500 rounded-full transition-all duration-300"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
          </div>
        )}

        <Button type="submit" className="w-full h-11 text-base font-semibold" disabled={isLoading}>
          {isLoading ? (
            <><Spinner size="sm" /> {step === "uploading" ? "Envoi des fichiers…" : "Envoi en cours…"}</>
          ) : (
            "Soumettre ma demande"
          )}
        </Button>
      </form>

      <div className="mt-5 flex items-center justify-between text-sm text-slate-500">
        <Link href={`/${locale}`} className="flex items-center gap-1 hover:text-slate-700 transition-colors">
          <ChevronLeft className="h-4 w-4" /> Retour à l&apos;accueil
        </Link>
        <Link href={`/${locale}/login`} className="text-brand-600 hover:text-brand-700 font-medium">
          Déjà un compte ? Se connecter
        </Link>
      </div>
    </div>
  );
}
