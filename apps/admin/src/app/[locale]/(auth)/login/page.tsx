"use client";

import Link from "next/link";
import { use } from "react";
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
import { Eye, EyeOff } from "lucide-react";
import Image from "next/image";
import { useState } from "react";

const LoginSchema = z.object({
  identifier: z.string().min(1),
  password: z.string().min(1),
});

type LoginData = z.infer<typeof LoginSchema>;

export default function LoginPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = use(params);
  const [showPassword, setShowPassword] = useState(false);
  const t = useTranslations("auth");
  const router = useRouter();
  const { login } = useAuthStore();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginData>({ resolver: zodResolver(LoginSchema) });

  const onSubmit = async (data: LoginData) => {
    try {
      const res = await api.post("/auth/admin/login", data);
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
        tokens: {
          access_token: string;
          refresh_token: string;
        };
      };
      const { admin, tokens } = payload;

      if (admin.role !== "admin" && admin.role !== "superadmin") {
        toast.error(t("loginError"));
        return;
      }

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
      toast.error(message ?? t("loginError"));
    }
  };

  return (
    <div className="mx-auto max-w-sm w-full">
      <div className="flex flex-col items-center mb-8">
        <Image
          src="/logo.png"
          alt="Dash Meal"
          width={180}
          height={140}
          className="mb-2 drop-shadow-2xl"
          priority
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
