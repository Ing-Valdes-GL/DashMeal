import { supabase } from "../config/supabase.js";
import { OTP_EXPIRES_IN_MINUTES, OTP_LENGTH } from "@dash-meal/shared";
import { env } from "../config/env.js";
import { AppError } from "../middleware/errorHandler.js";

const OTP_MAX_ATTEMPTS  = 3;
const OTP_WINDOW_MIN    = 10;
const OTP_BLOCK_MIN     = 30;

function generateCode(): string {
  return Math.floor(
    Math.pow(10, OTP_LENGTH - 1) +
    Math.random() * 9 * Math.pow(10, OTP_LENGTH - 1)
  )
    .toString()
    .padStart(OTP_LENGTH, "0");
}

function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (phone.startsWith("+")) return `+${digits}`;
  if (digits.startsWith("237")) return `+${digits}`;
  return `+237${digits}`;
}

async function checkAndIncrementRateLimit(phone: string): Promise<void> {
  const now = new Date();
  const windowStart = new Date(now.getTime() - OTP_WINDOW_MIN * 60 * 1000);

  const { data } = await supabase
    .from("otp_rate_limits")
    .select("*")
    .eq("phone", phone)
    .single();

  if (data) {
    // Vérifier si bloqué
    if (data.blocked_until && new Date(data.blocked_until) > now) {
      const minutesLeft = Math.ceil((new Date(data.blocked_until).getTime() - now.getTime()) / 60000);
      throw new AppError(429, "OTP_RATE_LIMIT", `Trop de tentatives. Réessayez dans ${minutesLeft} min.`);
    }

    // Réinitialiser la fenêtre si expirée
    if (new Date(data.window_start) < windowStart) {
      await supabase.from("otp_rate_limits").update({
        attempts: 1,
        window_start: now.toISOString(),
        blocked_until: null,
      }).eq("phone", phone);
      return;
    }

    // Incrémenter
    const newAttempts = data.attempts + 1;
    const blocked_until = newAttempts >= OTP_MAX_ATTEMPTS
      ? new Date(now.getTime() + OTP_BLOCK_MIN * 60 * 1000).toISOString()
      : null;

    await supabase.from("otp_rate_limits").update({
      attempts: newAttempts,
      blocked_until,
    }).eq("phone", phone);

    if (newAttempts >= OTP_MAX_ATTEMPTS) {
      throw new AppError(429, "OTP_RATE_LIMIT", `Trop de tentatives. Compte bloqué ${OTP_BLOCK_MIN} min.`);
    }
  } else {
    await supabase.from("otp_rate_limits").insert({
      phone,
      attempts: 1,
      window_start: now.toISOString(),
    });
  }
}

export async function sendOtp(phone: string): Promise<{ code: string; smsSent: boolean }> {
  await checkAndIncrementRateLimit(phone);
  const normalized = normalizePhone(phone);
  const code = generateCode();
  const expiresAt = new Date(Date.now() + OTP_EXPIRES_IN_MINUTES * 60 * 1000);

  await supabase.from("otp_codes").upsert({
    phone,
    code,
    expires_at: expiresAt.toISOString(),
    is_used: false,
  });

  // Ne jamais logger le code OTP en production
  if (env.NODE_ENV !== "production") {
    console.log(`[OTP DEV] Code envoyé à ***${normalized.slice(-4)} — expire ${expiresAt.toLocaleTimeString()}`);
  }

  if (!env.TERMII_API_KEY) {
    console.warn("⚠️  TERMII_API_KEY manquant — SMS non envoyé");
    return { code, smsSent: false };
  }

  try {
    const response = await fetch(`${env.TERMII_BASE_URL}/api/sms/send`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: env.TERMII_API_KEY,
        to: normalized,
        from: env.TERMII_SENDER_ID || "N-Alert",
        sms: `Votre code de vérification Dash Meal : ${code}. Valable ${OTP_EXPIRES_IN_MINUTES} minutes.`,
        type: "plain",
        channel: "generic",
      }),
    });

    const result = await response.json() as { message_id?: string; message?: string; code?: string };

    if (!response.ok || result.code === "error") {
      console.error(`❌ Échec envoi SMS Termii (${response.status}): ${JSON.stringify(result)}`);
      return { code, smsSent: false };
    }

    console.log(`✅ SMS OTP Termii envoyé à ***${normalized.slice(-4)} (id: ${result.message_id ?? "n/a"})`);
    return { code, smsSent: true };
  } catch (err) {
    console.error("❌ Erreur réseau envoi SMS Termii:", err);
    return { code, smsSent: false };
  }
}

export async function verifyOtp(
  phone: string,
  code: string
): Promise<boolean> {
  const { data } = await supabase
    .from("otp_codes")
    .select("*")
    .eq("phone", phone)
    .eq("code", code)
    .eq("is_used", false)
    .gt("expires_at", new Date().toISOString())
    .single();

  if (!data) return false;

  await supabase
    .from("otp_codes")
    .update({ is_used: true })
    .eq("id", data.id);

  return true;
}
