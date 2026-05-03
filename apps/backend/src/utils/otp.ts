import { supabase } from "../config/supabase.js";
import { OTP_EXPIRES_IN_MINUTES, OTP_LENGTH } from "@dash-meal/shared";
import { env } from "../config/env.js";

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

  await supabase.from("otp_codes").upsert({
    phone,
    code,
    expires_at: expiresAt.toISOString(),
    is_used: false,
  });

  console.log(`\n🔑 OTP ──────────────────────────────`);
  console.log(`   Téléphone : ${normalized}`);
  console.log(`   Code      : ${code}`);
  console.log(`   Expire    : ${expiresAt.toLocaleTimeString()}`);
  console.log(`─────────────────────────────────────\n`);

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
        ...(env.TERMII_SENDER_ID ? { from: env.TERMII_SENDER_ID } : {}),
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

    console.log(`✅ SMS OTP Termii envoyé à ${normalized} (id: ${result.message_id ?? "n/a"})`);
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
