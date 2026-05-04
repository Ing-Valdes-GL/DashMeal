"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import axios from "axios";
import { useBranchAuthStore } from "@/stores/branch-auth";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import logo from "@/assets/logo.png";
import { use } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "https://hopeful-gentleness-production.up.railway.app/api/v1";

const LoginSchema = z.object({
  phone:    z.string().min(8, "Numéro de téléphone invalide"),
  password: z.string().min(6, "Mot de passe requis"),
});
type LoginForm = z.infer<typeof LoginSchema>;

export default function BranchLoginPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = use(params);
  const router = useRouter();
  const { login } = useBranchAuthStore();
  const [showPass, setShowPass] = useState(false);

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<LoginForm>({
    resolver: zodResolver(LoginSchema),
  });

  const loginMutation = useMutation({
    mutationFn: async (data: LoginForm) => {
      const res = await axios.post(`${API_URL}/branch-auth/login`, data);
      return res.data.data as { manager: any; tokens: { access_token: string; refresh_token: string } };
    },
    onSuccess: (data) => {
      login(data.manager, data.tokens.access_token, data.tokens.refresh_token);
      toast.success("Connexion réussie");
      router.push(`/${locale}/branch-dashboard`);
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.error?.message ?? "Identifiants incorrects";
      toast.error(msg);
    },
  });

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-brand-50 to-slate-100 p-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <Image src={logo} alt="Dash Meal" width={64} height={64} className="rounded-2xl shadow-md mb-3" unoptimized />
          <h1 className="text-2xl font-bold text-slate-900">Dash Meal</h1>
          <p className="text-sm text-slate-500 mt-1">Portail Agence</p>
        </div>

        <Card className="border-0 shadow-xl">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg font-semibold text-slate-800 text-center">Connexion Manager</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit((d) => loginMutation.mutate(d))} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="phone">Numéro de téléphone</Label>
                <Input
                  id="phone"
                  type="tel"
                  placeholder="+237 6XX XXX XXX"
                  {...register("phone")}
                  className={errors.phone ? "border-red-400" : ""}
                />
                {errors.phone && <p className="text-xs text-red-500">{errors.phone.message}</p>}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="password">Mot de passe</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPass ? "text" : "password"}
                    placeholder="••••••••"
                    {...register("password")}
                    className={errors.password ? "border-red-400" : ""}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass(!showPass)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-600"
                  >
                    {showPass ? "Masquer" : "Afficher"}
                  </button>
                </div>
                {errors.password && <p className="text-xs text-red-500">{errors.password.message}</p>}
              </div>

              <Button
                type="submit"
                className="w-full bg-brand-600 hover:bg-brand-700"
                disabled={isSubmitting || loginMutation.isPending}
              >
                {loginMutation.isPending ? "Connexion..." : "Se connecter"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-slate-400 mt-6">
          Vos identifiants sont fournis par l'administrateur de votre marque.
        </p>
      </div>
    </div>
  );
}
