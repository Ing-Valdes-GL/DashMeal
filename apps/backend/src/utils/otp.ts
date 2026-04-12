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

export async function sendOtp(phone: string): Promise<void> {
  const code = generateCode();
  const expiresAt = new Date(Date.now() + OTP_EXPIRES_IN_MINUTES * 60 * 1000);

  // Stocker le code en base (table otp_codes)
  await supabase.from("otp_codes").upsert({
    phone,
    code,
    expires_at: expiresAt.toISOString(),
    is_used: false,
  });

  // Envoyer via AfricasTalking
  const body = new URLSearchParams({
    username: env.AT_USERNAME,
    to: phone,
    message: `Votre code de vérification Dash Meal : ${code}. Valable ${OTP_EXPIRES_IN_MINUTES} minutes.`,
    from: env.AT_SENDER_ID,
  });

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
    throw new Error(`Échec envoi SMS OTP: ${response.statusText}`);
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
