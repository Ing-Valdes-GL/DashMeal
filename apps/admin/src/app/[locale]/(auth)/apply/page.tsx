"use client";

import Link from "next/link";
import { use, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useTranslations } from "next-intl";
import { AxiosError } from "axios";
import { api } from "@/lib/api";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { CheckCircle2, Store, Mail, Phone, MapPin, User, Lock, ChevronLeft } from "lucide-react";

const ApplySchema = z.object({
  brand_name: z.string().min(2, "Nom de la marque requis (min 2 caractères)"),
  contact_name: z.string().min(2, "Nom du responsable requis"),
  contact_email: z.string().email("Email invalide"),
  contact_phone: z.string().regex(/^\+?[1-9]\d{7,14}$/, "Numéro de téléphone invalide (ex: +237600000000)"),
  city: z.string().min(2, "Ville requise"),
  description: z.string().min(20, "Décrivez votre activité (min 20 caractères)").max(500),
  password: z.string().min(8, "Mot de passe minimum 8 caractères"),
});

type ApplyData = z.infer<typeof ApplySchema>;

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

export default function ApplyPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = use(params);
  const [submitted, setSubmitted] = useState(false);
  const t = useTranslations("auth");

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ApplyData>({ resolver: zodResolver(ApplySchema) });

  const onSubmit = async (data: ApplyData) => {
    try {
      await api.post("/auth/apply", data);
      setSubmitted(true);
    } catch (error) {
      const message =
        error instanceof AxiosError
          ? (error.response?.data as { error?: { message?: string } })?.error?.message
          : undefined;
      toast.error(message ?? "Une erreur est survenue. Veuillez réessayer.");
    }
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
          Votre demande d&apos;accès à Dash Meal a bien été reçue. Notre équipe vous contactera dans les 24-48h ouvrables pour finaliser l&apos;activation de votre compte.
        </p>
        <div className="bg-brand-50 border border-brand-100 rounded-xl p-4 mb-6 text-left">
          <p className="text-sm font-semibold text-brand-700 mb-1">Prochaines étapes</p>
          <ul className="text-sm text-brand-600 space-y-1">
            <li>✓ Vérification de vos informations</li>
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

  return (
    <div className="mx-auto max-w-xl w-full">
      {/* Header */}
      <div className="flex flex-col items-center mb-8">
        <DashMealLogo className="h-12 w-12 mb-3" />
        <h1 className="text-2xl font-bold text-slate-900">Rejoignez Dash Meal</h1>
        <p className="mt-1 text-sm text-slate-500 text-center max-w-sm">
          Remplissez ce formulaire pour déposer votre demande d&apos;accès à la plateforme.
        </p>
      </div>

      <Card className="border-slate-200 bg-white shadow-card">
        <CardHeader className="pb-2">
          <CardTitle className="text-base text-slate-800">Informations de votre marque</CardTitle>
          <CardDescription>Toutes les informations seront vérifiées par notre équipe.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {/* Marque */}
            <div className="space-y-1.5">
              <Label htmlFor="brand_name" className="flex items-center gap-1.5 text-slate-700">
                <Store className="h-3.5 w-3.5 text-slate-400" /> Nom de la marque / restaurant
              </Label>
              <Input id="brand_name" placeholder="Ex: Délices du Cameroun" {...register("brand_name")} />
              {errors.brand_name && <p className="text-xs text-red-600">{errors.brand_name.message}</p>}
            </div>

            {/* Responsable */}
            <div className="space-y-1.5">
              <Label htmlFor="contact_name" className="flex items-center gap-1.5 text-slate-700">
                <User className="h-3.5 w-3.5 text-slate-400" /> Nom du responsable
              </Label>
              <Input id="contact_name" placeholder="Ex: Jean Dupont" {...register("contact_name")} />
              {errors.contact_name && <p className="text-xs text-red-600">{errors.contact_name.message}</p>}
            </div>

            {/* Email + Phone row */}
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

            {/* Ville */}
            <div className="space-y-1.5">
              <Label htmlFor="city" className="flex items-center gap-1.5 text-slate-700">
                <MapPin className="h-3.5 w-3.5 text-slate-400" /> Ville
              </Label>
              <Input id="city" placeholder="Ex: Yaoundé, Douala, Libreville..." {...register("city")} />
              {errors.city && <p className="text-xs text-red-600">{errors.city.message}</p>}
            </div>

            {/* Description */}
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

            {/* Password */}
            <div className="space-y-1.5">
              <Label htmlFor="password" className="flex items-center gap-1.5 text-slate-700">
                <Lock className="h-3.5 w-3.5 text-slate-400" /> Choisissez un mot de passe
              </Label>
              <Input id="password" type="password" placeholder="Minimum 8 caractères" {...register("password")} />
              {errors.password && <p className="text-xs text-red-600">{errors.password.message}</p>}
            </div>

            <Button type="submit" className="w-full h-10 text-base font-semibold" disabled={isSubmitting}>
              {isSubmitting ? (
                <><Spinner size="sm" /> Envoi en cours...</>
              ) : (
                "Soumettre ma demande"
              )}
            </Button>
          </form>
        </CardContent>
      </Card>

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
