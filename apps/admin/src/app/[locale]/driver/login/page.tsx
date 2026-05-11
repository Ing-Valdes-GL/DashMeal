"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useDriverAuthStore } from "@/stores/driver-auth";

type Step = "phone" | "otp";

export default function DriverLoginPage() {
  const router = useRouter();
  const { login } = useDriverAuthStore();
  const [step, setStep]   = useState<Step>("phone");
  const [phone, setPhone] = useState("");
  const [otp, setOtp]     = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState("");
  const [countdown, setCountdown] = useState(0);

  const startCountdown = () => {
    setCountdown(60);
    const t = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) { clearInterval(t); return 0; }
        return c - 1;
      });
    }, 1000);
  };

  const handleSendOtp = async () => {
    setError("");
    if (!phone.trim()) { setError("Entrez votre numéro de téléphone"); return; }
    setLoading(true);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/driver/send-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone }),
      });
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error?.message ?? "Erreur lors de l'envoi du code");
      }
      setStep("otp");
      startCountdown();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    setError("");
    if (otp.length < 6) { setError("Le code doit contenir 6 chiffres"); return; }
    setLoading(true);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/driver/verify-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, otp }),
      });
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error?.message ?? "Code incorrect ou expiré");
      }
      const body = await res.json();
      login(body.data.driver, body.data.access_token, body.data.refresh_token);
      router.replace("/fr/driver/deliveries");
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center px-6">
      {/* Logo */}
      <div className="mb-10 flex flex-col items-center gap-3">
        <div className="w-16 h-16 rounded-2xl bg-orange-500 flex items-center justify-center shadow-lg shadow-orange-500/30">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="white">
            <path d="M18.5 17.5a3.5 3.5 0 1 0-7 0 3.5 3.5 0 0 0 7 0ZM5.5 17.5a3.5 3.5 0 1 0-7 0 3.5 3.5 0 0 0 7 0ZM15 6a1 1 0 0 0-1-1h-1M12 6l-3 6H5.5M12 6l2.5 5.5M15 12h3.5L17 6"/>
          </svg>
        </div>
        <div className="text-center">
          <p className="text-white font-bold text-xl">Dash Meal</p>
          <p className="text-orange-400 font-semibold text-sm">Espace Livreur</p>
        </div>
      </div>

      {/* Card */}
      <div className="w-full max-w-sm bg-slate-800 rounded-3xl p-6 shadow-2xl border border-slate-700">
        {step === "phone" ? (
          <>
            <h1 className="text-white font-bold text-xl mb-1">Connexion</h1>
            <p className="text-slate-400 text-sm mb-6">Entrez votre numéro pour recevoir un code SMS</p>

            <label className="text-slate-300 text-xs font-semibold mb-1.5 block">Téléphone</label>
            <div className="flex items-center bg-slate-700 rounded-xl border border-slate-600 mb-4 overflow-hidden">
              <span className="px-3 text-slate-400 text-sm font-mono border-r border-slate-600 py-3">+237</span>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="6XX XXX XXX"
                className="flex-1 bg-transparent text-white px-3 py-3 text-sm outline-none placeholder:text-slate-500"
                onKeyDown={(e) => e.key === "Enter" && handleSendOtp()}
              />
            </div>

            {error && <p className="text-red-400 text-xs mb-4">{error}</p>}

            <button
              onClick={handleSendOtp}
              disabled={loading}
              className="w-full bg-orange-500 hover:bg-orange-600 text-white font-bold py-3.5 rounded-xl transition-colors disabled:opacity-50"
            >
              {loading ? "Envoi…" : "Recevoir le code"}
            </button>
          </>
        ) : (
          <>
            <button onClick={() => setStep("phone")} className="text-slate-400 text-sm mb-4 flex items-center gap-1 hover:text-white transition-colors">
              ← Retour
            </button>
            <h1 className="text-white font-bold text-xl mb-1">Code SMS</h1>
            <p className="text-slate-400 text-sm mb-6">Code envoyé au <span className="text-orange-400 font-mono">+237 {phone}</span></p>

            <input
              type="text"
              inputMode="numeric"
              maxLength={6}
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
              placeholder="• • • • • •"
              className="w-full bg-slate-700 border border-slate-600 rounded-xl text-white text-center text-2xl font-mono py-4 outline-none focus:border-orange-500 mb-4 tracking-[0.5em] placeholder:text-slate-600"
              onKeyDown={(e) => e.key === "Enter" && handleVerifyOtp()}
            />

            {error && <p className="text-red-400 text-xs mb-3">{error}</p>}

            <button
              onClick={handleVerifyOtp}
              disabled={loading || otp.length < 6}
              className="w-full bg-orange-500 hover:bg-orange-600 text-white font-bold py-3.5 rounded-xl transition-colors disabled:opacity-50 mb-3"
            >
              {loading ? "Vérification…" : "Se connecter"}
            </button>

            <button
              onClick={() => { if (countdown === 0) handleSendOtp(); }}
              disabled={countdown > 0}
              className="w-full text-slate-400 text-sm py-2 disabled:opacity-50"
            >
              {countdown > 0 ? `Renvoyer dans ${countdown}s` : "Renvoyer le code"}
            </button>
          </>
        )}
      </div>

      <p className="text-slate-600 text-xs mt-8 text-center">
        Seuls les livreurs enregistrés peuvent se connecter.
      </p>
    </div>
  );
}
