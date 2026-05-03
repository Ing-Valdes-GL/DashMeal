"use client";

import { useState, use } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { AxiosError } from "axios";
import { useAuthStore } from "@/stores/auth";
import { api } from "@/lib/api";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { Eye, EyeOff, ShieldCheck, Mail, ArrowLeft } from "lucide-react";

const RegisterSchema = z
  .object({
    email: z.string().email(),
    phone: z.string().regex(/^\+?[1-9]\d{7,14}$/),
    password: z.string().min(8),
    confirmPassword: z.string().min(8),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

const LoginSchema = z.object({
  identifier: z.string().min(1),
  password: z.string().min(1),
});

const OtpSchema = z.object({
  code: z.string().length(6, "Code must be 6 digits"),
});

type RegisterData = z.infer<typeof RegisterSchema>;
type LoginData = z.infer<typeof LoginSchema>;
type OtpData = z.infer<typeof OtpSchema>;

export default function SuperadminAuthPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = use(params);
  const router = useRouter();
  const { login } = useAuthStore();
  const [mode, setMode] = useState<"register" | "login">("register");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loginStep, setLoginStep] = useState<"credentials" | "otp">("credentials");
  const [pendingIdentifier, setPendingIdentifier] = useState("");
  const [otpEmail, setOtpEmail] = useState("");

  const registerForm = useForm<RegisterData>({
    resolver: zodResolver(RegisterSchema),
    defaultValues: { email: "", phone: "", password: "", confirmPassword: "" },
  });

  const loginForm = useForm<LoginData>({
    resolver: zodResolver(LoginSchema),
    defaultValues: { identifier: "", password: "" },
  });

  const otpForm = useForm<OtpData>({
    resolver: zodResolver(OtpSchema),
    defaultValues: { code: "" },
  });

  const toMessage = (error: unknown, fallback: string) => {
    if (error instanceof AxiosError) {
      if (!error.response) return "Impossible de joindre le serveur";
      return (
        (error.response.data as { error?: { message?: string } })?.error?.message ?? fallback
      );
    }
    return fallback;
  };

  const onRegister = async (data: RegisterData) => {
    try {
      const response = await api.post("/auth/superadmin/register", {
        email: data.email,
        phone: data.phone,
        password: data.password,
      });

      const payload = response.data.data as {
        admin: { id: string; email: string; phone?: string; role?: "superadmin" };
        tokens: { access_token: string; refresh_token: string };
      };

      login(
        {
          id: payload.admin.id,
          email: payload.admin.email,
          username: payload.admin.email.split("@")[0],
          phone: payload.admin.phone,
          role: "superadmin",
        },
        payload.tokens.access_token,
        payload.tokens.refresh_token
      );

      toast.success("Superadmin created and connected");
      router.push(`/${locale}/superadmin/platform`);
    } catch (error) {
      toast.error(toMessage(error, "Unable to create superadmin"));
    }
  };

  const onLogin = async (data: LoginData) => {
    try {
      const response = await api.post("/auth/superadmin/login", data);
      const payload = response.data.data as { requires_otp: true; email: string };
      setPendingIdentifier(data.identifier);
      setOtpEmail(payload.email);
      setLoginStep("otp");
      toast.success(`Code sent to ${payload.email}`);
    } catch (error) {
      toast.error(toMessage(error, "Unable to connect"));
    }
  };

  const onOtpSubmit = async (data: OtpData) => {
    try {
      const response = await api.post("/auth/superadmin/verify-otp", {
        identifier: pendingIdentifier,
        code: data.code,
      });
      const payload = response.data.data as {
        admin: { id: string; email: string; phone?: string };
        tokens: { access_token: string; refresh_token: string };
      };

      login(
        {
          id: payload.admin.id,
          email: payload.admin.email,
          username: payload.admin.email.split("@")[0],
          phone: payload.admin.phone,
          role: "superadmin",
        },
        payload.tokens.access_token,
        payload.tokens.refresh_token
      );

      toast.success("Connected");
      router.push(`/${locale}/superadmin/platform`);
    } catch (error) {
      toast.error(toMessage(error, "Invalid or expired code"));
    }
  };

  const isRegister = mode === "register";

  return (
    <div className="mx-auto max-w-md w-full">
      <div className="flex flex-col items-center mb-8">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-500 shadow-2xl shadow-brand-500/40 mb-4">
          <ShieldCheck className="h-7 w-7 text-white" />
        </div>
        <h1 className="text-2xl font-bold text-white">Superadmin Access</h1>
        <p className="mt-1 text-sm text-slate-400">Register or sign in to superadmin panel</p>
      </div>

      <Card className="border-surface-600/50 bg-surface-800/60 backdrop-blur-sm">
        <CardContent className="pt-6">
          <div className="mb-4 grid grid-cols-2 gap-2">
            <Button
              type="button"
              variant={isRegister ? "default" : "outline"}
              onClick={() => setMode("register")}
            >
              Register
            </Button>
            <Button
              type="button"
              variant={!isRegister ? "default" : "outline"}
              onClick={() => setMode("login")}
            >
              Login
            </Button>
          </div>

          {isRegister ? (
            <form onSubmit={registerForm.handleSubmit(onRegister)} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="register_email">Email</Label>
                <Input
                  id="register_email"
                  type="email"
                  autoComplete="email"
                  {...registerForm.register("email")}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="register_phone">Phone</Label>
                <Input
                  id="register_phone"
                  type="tel"
                  placeholder="+237679811919"
                  autoComplete="tel"
                  {...registerForm.register("phone")}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="register_password">Password</Label>
                <div className="relative">
                  <Input
                    id="register_password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="new-password"
                    {...registerForm.register("password")}
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="register_confirm_password">Confirm password</Label>
                <div className="relative">
                  <Input
                    id="register_confirm_password"
                    type={showConfirmPassword ? "text" : "password"}
                    autoComplete="new-password"
                    {...registerForm.register("confirmPassword")}
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                  >
                    {showConfirmPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>

              {registerForm.formState.errors.confirmPassword && (
                <p className="text-xs text-red-400">
                  {registerForm.formState.errors.confirmPassword.message}
                </p>
              )}

              <Button
                type="submit"
                className="w-full h-10 text-base font-semibold mt-2"
                disabled={registerForm.formState.isSubmitting}
              >
                {registerForm.formState.isSubmitting ? (
                  <>
                    <Spinner size="sm" />
                    Creating...
                  </>
                ) : (
                  "Create superadmin"
                )}
              </Button>
            </form>
          ) : loginStep === "credentials" ? (
            <form onSubmit={loginForm.handleSubmit(onLogin)} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="login_identifier">Email or phone</Label>
                <Input
                  id="login_identifier"
                  type="text"
                  autoComplete="username"
                  {...loginForm.register("identifier")}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="login_password">Password</Label>
                <Input
                  id="login_password"
                  type="password"
                  autoComplete="current-password"
                  {...loginForm.register("password")}
                />
              </div>

              <Button
                type="submit"
                className="w-full h-10 text-base font-semibold mt-2"
                disabled={loginForm.formState.isSubmitting}
              >
                {loginForm.formState.isSubmitting ? (
                  <>
                    <Spinner size="sm" />
                    Connecting...
                  </>
                ) : (
                  "Connect"
                )}
              </Button>
            </form>
          ) : (
            <form onSubmit={otpForm.handleSubmit(onOtpSubmit)} className="space-y-4">
              <div className="flex items-center gap-2 p-3 rounded-lg bg-brand-500/10 border border-brand-500/20">
                <Mail className="h-4 w-4 text-brand-400 shrink-0" />
                <p className="text-sm text-slate-300">Code sent to <span className="font-medium text-white">{otpEmail}</span></p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="otp_code">6-digit code</Label>
                <Input
                  id="otp_code"
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  autoFocus
                  placeholder="123456"
                  className="text-center text-xl tracking-widest font-mono"
                  {...otpForm.register("code")}
                />
                {otpForm.formState.errors.code && (
                  <p className="text-xs text-red-400">{otpForm.formState.errors.code.message}</p>
                )}
              </div>

              <Button
                type="submit"
                className="w-full h-10 text-base font-semibold"
                disabled={otpForm.formState.isSubmitting}
              >
                {otpForm.formState.isSubmitting ? (
                  <>
                    <Spinner size="sm" />
                    Verifying...
                  </>
                ) : (
                  "Verify"
                )}
              </Button>

              <button
                type="button"
                onClick={() => { setLoginStep("credentials"); otpForm.reset(); }}
                className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-300 mx-auto"
              >
                <ArrowLeft className="h-4 w-4" />
                Back
              </button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
