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

export async function sendOtp(phone: string): Promise<void> {
  const normalized = normalizePhone(phone);
  const code = generateCode();
  const expiresAt = new Date(Date.now() + OTP_EXPIRES_IN_MINUTES * 60 * 1000);

  // Stocker le code en base (table otp_codes)
  await supabase.from("otp_codes").upsert({
    phone,
    code,
    expires_at: expiresAt.toISOString(),
    is_used: false,
  });

  // Toujours logger en console (utile pour debug)
  console.log(`\n🔑 OTP ──────────────────────────────`);
  console.log(`   Téléphone : ${normalized}`);
  console.log(`   Code      : ${code}`);
  console.log(`   Expire    : ${expiresAt.toLocaleTimeString()}`);
  console.log(`─────────────────────────────────────\n`);

  // Envoyer via AfricasTalking si la clé est configurée
  if (!env.AT_API_KEY || !env.AT_USERNAME) {
    console.warn("⚠️  AT_API_KEY ou AT_USERNAME manquant — SMS non envoyé");
    return;
  }

  const body = new URLSearchParams({
    username: env.AT_USERNAME,
    to: normalized,
    message: `Votre code de vérification Dash Meal : ${code}. Valable ${OTP_EXPIRES_IN_MINUTES} minutes.`,
  });

  try {
    const response = await fetch(
      "https://api.africastalking.com/version1/messaging",
      {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/x-www-form-urlencoded",
          apiKey: env.AT_API_KEY,
        },
        body,
      }
    );

    if (!response.ok) {
      const errText = await response.text();
      console.error(`❌ Échec envoi SMS OTP (${response.status}): ${errText}`);
      return;
    }

    const result = await response.json() as { SMSMessageData?: { Recipients?: { status: string; number: string }[] } };
    const recipients = result.SMSMessageData?.Recipients ?? [];
    recipients.forEach((r) => {
      if (r.status === "Success") {
        console.log(`✅ SMS OTP envoyé à ${r.number}`);
      } else {
        console.warn(`⚠️  SMS OTP échoué pour ${r.number} : ${r.status}`);
      }
    });
  } catch (err) {
    console.error("❌ Erreur réseau envoi SMS OTP:", err);
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
