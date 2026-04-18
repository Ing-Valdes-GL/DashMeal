"use client";
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useTranslations, useLocale } from "next-intl";
import { useRouter, usePathname } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { apiPatch, apiPost } from "@/lib/api";
import { toast } from "@/hooks/use-toast";
import { useAuthStore } from "@/stores/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { User, Lock, Globe, Eye, EyeOff } from "lucide-react";

const ProfileSchema = z.object({
  username: z.string().min(2),
  email: z.string().email(),
  phone: z.string().optional(),
});
type ProfileForm = z.infer<typeof ProfileSchema>;

const PasswordSchema = z.object({
  current_password: z.string().min(6),
  new_password: z.string().min(8),
  confirm_password: z.string().min(8),
}).refine((d) => d.new_password === d.confirm_password, {
  message: "Les mots de passe ne correspondent pas",
  path: ["confirm_password"],
});
type PasswordForm = z.infer<typeof PasswordSchema>;

export default function SettingsPage() {
  const t = useTranslations("settings");
  const { user, updateUser } = useAuthStore();
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const [tab, setTab] = useState("profile");
  const [showPwd, setShowPwd] = useState(false);
  const [showNewPwd, setShowNewPwd] = useState(false);

  const { register: regProfile, handleSubmit: handleProfile, formState: { isSubmitting: profileLoading } } =
    useForm<ProfileForm>({
      resolver: zodResolver(ProfileSchema),
      defaultValues: {
        username: user?.username ?? "",
        email: user?.email ?? "",
        phone: user?.phone ?? "",
      },
    });

  const { register: regPwd, handleSubmit: handlePwd, reset: resetPwd,
    formState: { errors: pwdErrors, isSubmitting: pwdLoading } } =
    useForm<PasswordForm>({ resolver: zodResolver(PasswordSchema) });

  const profileMutation = useMutation({
    mutationFn: (d: ProfileForm) => apiPatch("/admins/me", d),
    onSuccess: (data: any) => {
      updateUser(data);
      toast.success("Profil mis à jour");
    },
    onError: () => toast.error("Erreur lors de la mise à jour"),
  });

  const passwordMutation = useMutation({
    mutationFn: (d: PasswordForm) =>
      apiPost("/auth/admin/change-password", {
        current_password: d.current_password,
        new_password: d.new_password,
      }),
    onSuccess: () => {
      toast.success("Mot de passe mis à jour");
      resetPwd();
    },
    onError: () => toast.error("Mot de passe actuel incorrect"),
  });

  const switchLocale = (newLocale: string) => {
    const newPath = pathname.replace(`/${locale}`, `/${newLocale}`);
    router.push(newPath);
  };

  return (
    <div className="space-y-5 animate-fade-in max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">{t("title")}</h1>
        <p className="text-sm text-slate-400">{t("subtitle")}</p>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="profile">
            <User className="h-3.5 w-3.5 mr-1.5" />{t("profile")}
          </TabsTrigger>
          <TabsTrigger value="security">
            <Lock className="h-3.5 w-3.5 mr-1.5" />{t("security")}
          </TabsTrigger>
          <TabsTrigger value="preferences">
            <Globe className="h-3.5 w-3.5 mr-1.5" />Préférences
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {tab === "profile" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <User className="h-4 w-4 text-brand-400" /> {t("profile")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {/* Avatar */}
            <div className="flex items-center gap-4 mb-6">
              <div className="h-16 w-16 rounded-full bg-brand-500/20 flex items-center justify-center text-brand-400 text-xl font-bold">
                {user?.username?.slice(0, 2).toUpperCase() ?? "AD"}
              </div>
              <div>
                <p className="font-medium text-slate-900">{user?.username}</p>
                <p className="text-sm text-slate-500 capitalize">{user?.role}</p>
                {user?.brand_name && (
                  <p className="text-xs text-brand-400 mt-0.5">{user.brand_name}</p>
                )}
              </div>
            </div>
            <Separator className="mb-5" />

            <form onSubmit={handleProfile((d) => profileMutation.mutate(d))} className="space-y-4">
              <div className="space-y-1.5">
                <Label>{t("name")}</Label>
                <Input {...regProfile("username")} placeholder="Nom d'utilisateur" />
              </div>
              <div className="space-y-1.5">
                <Label>{t("email")}</Label>
                <Input {...regProfile("email")} type="email" placeholder="email@example.com" />
              </div>
              <div className="space-y-1.5">
                <Label>{t("phone")} <span className="text-slate-500 text-xs">(optionnel)</span></Label>
                <Input {...regProfile("phone")} placeholder="+237 6XX XXX XXX" />
              </div>
              <Button type="submit" disabled={profileLoading}>
                {profileLoading ? "..." : t("saveProfile")}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {tab === "security" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Lock className="h-4 w-4 text-brand-400" /> {t("security")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handlePwd((d) => passwordMutation.mutate(d))} className="space-y-4">
              <div className="space-y-1.5">
                <Label>{t("currentPassword")}</Label>
                <div className="relative">
                  <Input
                    {...regPwd("current_password")}
                    type={showPwd ? "text" : "password"}
                    placeholder="••••••••"
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPwd(!showPwd)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-700"
                  >
                    {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <Separator />

              <div className="space-y-1.5">
                <Label>{t("newPassword")}</Label>
                <div className="relative">
                  <Input
                    {...regPwd("new_password")}
                    type={showNewPwd ? "text" : "password"}
                    placeholder="Minimum 8 caractères"
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPwd(!showNewPwd)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-700"
                  >
                    {showNewPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>{t("confirmPassword")}</Label>
                <Input
                  {...regPwd("confirm_password")}
                  type="password"
                  placeholder="Confirmer le mot de passe"
                />
                {pwdErrors.confirm_password && (
                  <p className="text-xs text-red-400">{pwdErrors.confirm_password.message}</p>
                )}
              </div>

              <Button type="submit" disabled={pwdLoading || passwordMutation.isPending}>
                {passwordMutation.isPending ? "..." : t("changePassword")}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {tab === "preferences" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Globe className="h-4 w-4 text-brand-400" /> Préférences
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            {/* Language */}
            <div>
              <p className="text-sm font-medium text-slate-900 mb-2">{t("language")}</p>
              <div className="flex gap-2">
                {["fr", "en"].map((l) => (
                  <button
                    key={l}
                    onClick={() => switchLocale(l)}
                    className={`flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm transition-colors ${
                      locale === l
                        ? "border-brand-500 bg-brand-500/10 text-brand-400"
                        : "border-slate-200 text-slate-400 hover:border-slate-300"
                    }`}
                  >
                    <span className="text-base">{l === "fr" ? "🇫🇷" : "🇬🇧"}</span>
                    {l === "fr" ? "Français" : "English"}
                  </button>
                ))}
              </div>
            </div>

            <Separator />

            {/* Info */}
            <div className="rounded-xl bg-slate-100 border border-slate-200 p-4 text-sm text-slate-400">
              <p className="text-slate-900 font-medium mb-2">Informations du compte</p>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <p className="text-slate-500">Rôle</p>
                  <p className="text-slate-900 capitalize">{user?.role}</p>
                </div>
                <div>
                  <p className="text-slate-500">ID Admin</p>
                  <p className="text-slate-900 font-mono">{user?.id?.slice(0, 8)}…</p>
                </div>
                {user?.brand_name && (
                  <div>
                    <p className="text-slate-500">Marque</p>
                    <p className="text-brand-400">{user.brand_name}</p>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
