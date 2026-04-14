"use client";

import Link from "next/link";
import { use } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useTranslations } from "next-intl";
import { AxiosError } from "axios";
import { toast } from "@/hooks/use-toast";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { Zap } from "lucide-react";

const SignInSchema = z
  .object({
    brand_name: z.string().min(2),
    contact_email: z.string().email(),
    contact_phone: z.string().regex(/^\+?[1-9]\d{7,14}$/),
    password: z.string().min(8),
    confirm_password: z.string().min(8),
  })
  .refine((data) => data.password === data.confirm_password, {
    message: "password_mismatch",
    path: ["confirm_password"],
  });

type SignInData = z.infer<typeof SignInSchema>;

export default function SignInPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = use(params);
  const t = useTranslations("auth");

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<SignInData>({
    resolver: zodResolver(SignInSchema),
    defaultValues: {
      brand_name: "",
      contact_email: "",
      contact_phone: "",
      password: "",
      confirm_password: "",
    },
  });

  const onSubmit = async (data: SignInData) => {
    try {
      await api.post("/brands/apply", {
        brand_name: data.brand_name,
        contact_email: data.contact_email,
        contact_phone: data.contact_phone,
      });

      toast.success(t("signUpSuccess"));
      reset();
    } catch (error) {
      const message = error instanceof AxiosError
        ? error.response
          ? (error.response?.data as { error?: { message?: string } })?.error?.message
          : "Backend indisponible (http://localhost:3001)"
        : undefined;
      toast.error(message ?? t("signUpError"));
    }
  };

  return (
    <div className="mx-auto max-w-sm w-full">
      <div className="flex flex-col items-center mb-8">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-500 shadow-2xl shadow-brand-500/40 mb-4">
          <Zap className="h-7 w-7 text-white" />
        </div>
        <h1 className="text-2xl font-bold text-white">{t("signUpTitle")}</h1>
        <p className="mt-1 text-sm text-slate-400">{t("signUpSubtitle")}</p>
      </div>

      <Card className="border-surface-600/50 bg-surface-800/60 backdrop-blur-sm">
        <CardContent className="pt-6">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="brand_name">{t("brandName")}</Label>
              <Input id="brand_name" {...register("brand_name")} />
              {errors.brand_name && (
                <p className="text-xs text-red-400">{t("brandName")} invalide</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="contact_email">{t("email")}</Label>
              <Input
                id="contact_email"
                type="email"
                placeholder={t("emailPlaceholder")}
                autoComplete="email"
                {...register("contact_email")}
              />
              {errors.contact_email && (
                <p className="text-xs text-red-400">{t("email")} invalide</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="contact_phone">{t("phone")}</Label>
              <Input
                id="contact_phone"
                type="tel"
                placeholder={t("phonePlaceholder")}
                autoComplete="tel"
                {...register("contact_phone")}
              />
              {errors.contact_phone && (
                <p className="text-xs text-red-400">{t("phone")} invalide</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password">{t("password")}</Label>
              <Input
                id="password"
                type="password"
                placeholder={t("passwordPlaceholder")}
                autoComplete="new-password"
                {...register("password")}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="confirm_password">{t("confirmPassword")}</Label>
              <Input
                id="confirm_password"
                type="password"
                placeholder={t("passwordPlaceholder")}
                autoComplete="new-password"
                {...register("confirm_password")}
              />
              {errors.confirm_password && (
                <p className="text-xs text-red-400">
                  {errors.confirm_password.message === "password_mismatch"
                    ? t("passwordMismatch")
                    : t("confirmPassword")}
                </p>
              )}
            </div>

            <Button
              type="submit"
              className="w-full h-10 text-base font-semibold mt-2"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <Spinner size="sm" />
                  {t("signingUp")}
                </>
              ) : (
                t("signUpButton")
              )}
            </Button>
          </form>
        </CardContent>
      </Card>

      <p className="mt-4 text-center text-sm text-slate-400">
        {t("haveAccount")}{" "}
        <Link href={`/${locale}/login`} className="text-brand-400 hover:text-brand-300">
          {t("goToLogin")}
        </Link>
      </p>
    </div>
  );
}
