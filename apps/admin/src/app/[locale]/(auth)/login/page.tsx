"use client";

import Link from "next/link";
import { use, useState, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { AxiosError } from "axios";
import { useAuthStore } from "@/stores/auth";
import { api } from "@/lib/api";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { Eye, EyeOff, Mail, ArrowLeft, Home } from "lucide-react";
import Image from "next/image";
import logo from "@/assets/logo.png";

const LoginSchema = z.object({
  identifier: z.string().min(1),
  password: z.string().min(1),
});

const OtpSchema = z.object({
  code: z.string().length(6, "Le code doit contenir 6 chiffres"),
});

type LoginData = z.infer<typeof LoginSchema>;
type OtpData = z.infer<typeof OtpSchema>;

export default function LoginPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = use(params);
  const [showPassword, setShowPassword] = useState(false);
  const [step, setStep] = useState<"credentials" | "otp">("credentials");
  const [pendingIdentifier, setPendingIdentifier] = useState("");
  const [otpEmail, setOtpEmail] = useState("");
  const t = useTranslations("auth");
  const router = useRouter();
  const { login } = useAuthStore();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginData>({ resolver: zodResolver(LoginSchema) });

  const {
    register: registerOtp,
    handleSubmit: handleOtpSubmit,
    formState: { errors: otpErrors, isSubmitting: isOtpSubmitting },
    reset: resetOtp,
  } = useForm<OtpData>({ resolver: zodResolver(OtpSchema) });

  const onSubmit = async (data: LoginData) => {
    try {
      const res = await api.post("/auth/admin/login", data);
      const payload = res.data.data as { requires_otp: true; email: string };
      setPendingIdentifier(data.identifier);
      setOtpEmail(payload.email);
      setStep("otp");
      toast.success(`Code envoyé à ${payload.email}`);
    } catch (error) {
      const message =
        error instanceof AxiosError
          ? (error.response?.data as { error?: { message?: string } })?.error?.message
          : undefined;
      toast.error(message ?? t("loginError"));
    }
  };

  const onOtpSubmit = async (data: OtpData) => {
    try {
      const res = await api.post("/auth/admin/verify-otp", {
        identifier: pendingIdentifier,
        code: data.code,
      });
      const payload = res.data.data as {
        admin: {
          id: string;
          email: string;
          username?: string;
          phone?: string;
          role: "admin" | "superadmin";
          brand_id?: string;
          brand_name?: string;
        };
        tokens: { access_token: string; refresh_token: string };
      };
      const { admin, tokens } = payload;

      login(
        {
          id: admin.id,
          email: admin.email,
          username: admin.username ?? admin.email.split("@")[0],
          phone: admin.phone,
          role: admin.role,
          brand_id: admin.brand_id,
          brand_name: admin.brand_name,
        },
        tokens.access_token,
        tokens.refresh_token
      );

      toast.success("Connexion reussie");
      router.push(`/${locale}/dashboard`);
    } catch (error) {
      const message =
        error instanceof AxiosError
          ? (error.response?.data as { error?: { message?: string } })?.error?.message
          : undefined;
      toast.error(message ?? "Code invalide ou expiré");
    }
  };

  // Composant réutilisable pour le bouton d'accueil
  const HomeButton = () => (
    <div className="mb-6 flex justify-start">
      <Link
        href={`/${locale}`}
        className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 shadow-sm transition-colors hover:bg-slate-50 hover:text-slate-900"
      >
        <Home className="h-3.5 w-3.5 text-slate-500" />
        <span>Accueil</span>
      </Link>
    </div>
  );

  if (step === "otp") {
    return (
      <div className="mx-auto max-w-sm w-full">
        <HomeButton />

        <div className="flex flex-col items-center mb-8">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-500/10 border border-brand-500/30 mb-4">
            <Mail className="h-7 w-7 text-brand-500" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Vérification</h1>
          <p className="mt-1 text-sm text-slate-500 text-center">
            Code envoyé à<br />
            <span className="font-medium text-slate-700">{otpEmail}</span>
          </p>
        </div>

        <Card className="border-slate-200 bg-white shadow-card">
          <CardContent className="pt-6">
            <form onSubmit={handleOtpSubmit(onOtpSubmit)} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="code">Code OTP (6 chiffres)</Label>
                <Input
                  id="code"
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  autoFocus
                  placeholder="123456"
                  className={`text-center text-xl tracking-widest font-mono ${otpErrors.code ? "border-red-500" : ""}`}
                  {...registerOtp("code")}
                />
                {otpErrors.code && (
                  <p className="text-xs text-red-400">{otpErrors.code.message}</p>
                )}
              </div>

              <Button
                type="submit"
                className="w-full h-10 text-base font-semibold"
                disabled={isOtpSubmitting}
              >
                {isOtpSubmitting ? (
                  <>
                    <Spinner size="sm" />
                    Vérification...
                  </>
                ) : (
                  "Vérifier"
                )}
              </Button>

              <button
                type="button"
                onClick={() => { setStep("credentials"); resetOtp(); }}
                className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 mx-auto"
              >
                <ArrowLeft className="h-4 w-4" />
                Retour
              </button>
            </form>
          </CardContent>
        </Card>

        <p className="mt-6 text-center text-xs text-slate-400">
          Dash Meal Cameroun {new Date().getFullYear()}
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-sm w-full">
      <HomeButton />

      <div className="flex flex-col items-center mb-8">
        <Image
          src={logo}
          alt="logo image"
          width={180}
          height={140}
          className="mb-2 drop-shadow-2xl"
          priority
          unoptimized
        />
        <h1 className="text-2xl font-bold text-slate-900">{t("loginTitle")}</h1>
        <p className="mt-1 text-sm text-slate-500">{t("loginSubtitle")}</p>
      </div>

      <Card className="border-slate-200 bg-white shadow-card">
        <CardContent className="pt-6">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="identifier">{t("identifier")}</Label>
              <Input
                id="identifier"
                type="text"
                placeholder={t("identifierPlaceholder")}
                autoComplete="username"
                autoFocus
                {...register("identifier")}
                className={errors.identifier ? "border-red-500 focus:ring-red-500" : ""}
              />
              {errors.identifier && (
                <p className="text-xs text-red-400">{t("identifier")} invalide</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password">{t("password")}</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder={t("passwordPlaceholder")}
                  autoComplete="current-password"
                  {...register("password")}
                  className={errors.password ? "border-red-500 pr-10" : "pr-10"}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 transition-colors"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              className="w-full h-10 text-base font-semibold mt-2"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <Spinner size="sm" />
                  {t("loggingIn")}
                </>
              ) : (
                t("loginButton")
              )}
            </Button>
          </form>
        </CardContent>
      </Card>

      <p className="mt-6 text-center text-xs text-slate-400">
        Dash Meal Cameroun {new Date().getFullYear()}
      </p>
      <p className="mt-2 text-center text-sm text-slate-500">
        {t("noAccount")}{" "}
        <Link href={`/${locale}/signin`} className="text-brand-600 hover:text-brand-700 font-medium">
          {t("goToSignUp")}
        </Link>
      </p>
    </div>
  );
}