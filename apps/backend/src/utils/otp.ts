import { supabase } from "../config/supabase.js";
import { OTP_EXPIRES_IN_MINUTES, OTP_LENGTH } from "@dash-meal/shared";
import { env } from "../config/env.js";
import { AppError } from "../middleware/errorHandler.js";

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

export async function sendOtp(phone: string): Promise<{ code: string; smsSent: boolean }> {
  const normalized = normalizePhone(phone);
  const code = generateCode();
  const expiresAt = new Date(Date.now() + OTP_EXPIRES_IN_MINUTES * 60 * 1000);

  // Upsert dans la table otps (identifié par phone)
  await supabase.from("otps").upsert(
    { phone, otp: code, expires_at: expiresAt.toISOString() },
    { onConflict: "phone" }
  );

  if (!env.AT_API_KEY || !env.AT_USERNAME) {
    console.warn("⚠️  AT_API_KEY / AT_USERNAME manquants — SMS non envoyé");
    console.log(`[OTP] Code pour ***${normalized.slice(-4)} : ${code}`);
    return { code, smsSent: false };
  }

  try {
    const params = new URLSearchParams({
      username: env.AT_USERNAME,
      to:       normalized,
      message:  `Votre code de vérification Dash Meal : ${code}. Valable ${OTP_EXPIRES_IN_MINUTES} minutes.`,
    });
    if (env.AT_SENDER_ID) params.set("from", env.AT_SENDER_ID);

    const response = await fetch("https://api.africastalking.com/version1/messaging", {
      method: "POST",
      headers: {
        "apiKey":       env.AT_API_KEY,
        "Content-Type": "application/x-www-form-urlencoded",
        "Accept":       "application/json",
      },
      body: params.toString(),
    });

    const result = await response.json() as {
      SMSMessageData?: { Recipients?: { statusCode: number; messageId: string }[] };
    };

    const recipient = result.SMSMessageData?.Recipients?.[0];
    if (!response.ok || !recipient || recipient.statusCode !== 101) {
      console.error(`❌ Échec SMS Africa's Talking (${response.status}): ${JSON.stringify(result)}`);
      console.log(`[OTP] Code pour ***${normalized.slice(-4)} : ${code}`);
      return { code, smsSent: false };
    }

    console.log(`✅ SMS OTP envoyé à ***${normalized.slice(-4)} (id: ${recipient.messageId})`);
    return { code, smsSent: true };
  } catch (err) {
    console.error("❌ Erreur réseau SMS Africa's Talking:", err);
    console.log(`[OTP] Code pour ***${normalized.slice(-4)} : ${code}`);
    return { code, smsSent: false };
  }
}

export async function verifyOtp(phone: string, code: string): Promise<boolean> {
  const { data } = await supabase
    .from("otps")
    .select("id")
    .eq("phone", phone)
    .eq("otp", code)
    .gt("expires_at", new Date().toISOString())
    .single();

  if (!data) return false;

  // Supprimer l'OTP après vérification (usage unique)
  await supabase.from("otps").delete().eq("id", data.id);

  return true;
}

export async function sendEmailOtp(email: string): Promise<{ code: string; sent: boolean }> {
  const code = generateCode();
  const expiresAt = new Date(Date.now() + OTP_EXPIRES_IN_MINUTES * 60 * 1000);

  await supabase.from("otps").upsert(
    { email, otp: code, expires_at: expiresAt.toISOString() },
    { onConflict: "email" }
  );

  console.log(`[OTP EMAIL] Code pour ${email} : ${code}`);
  return { code, sent: false };
}

export async function verifyEmailOtp(email: string, code: string): Promise<boolean> {
  const { data } = await supabase
    .from("otps")
    .select("id")
    .eq("email", email)
    .eq("otp", code)
    .gt("expires_at", new Date().toISOString())
    .single();

  if (!data) return false;

  await supabase.from("otps").delete().eq("id", data.id);
  return true;
}
