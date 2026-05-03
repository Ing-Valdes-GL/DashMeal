import { Resend } from "resend";
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

export async function sendEmailOtp(email: string): Promise<{ code: string; emailSent: boolean }> {
  const code = generateCode();
  const expiresAt = new Date(Date.now() + OTP_EXPIRES_IN_MINUTES * 60 * 1000);

  await supabase.from("otp_codes").upsert({
    phone: email,
    code,
    expires_at: expiresAt.toISOString(),
    is_used: false,
  });

  console.log(`\n🔑 Email OTP ──────────────────────────────`);
  console.log(`   Email  : ${email}`);
  console.log(`   Code   : ${code}`);
  console.log(`   Expire : ${expiresAt.toLocaleTimeString()}`);
  console.log(`───────────────────────────────────────────\n`);

  if (!env.RESEND_API_KEY) {
    console.warn("⚠️  RESEND_API_KEY manquant — email non envoyé");
    return { code, emailSent: false };
  }

  try {
    const resend = new Resend(env.RESEND_API_KEY);
    const { error } = await resend.emails.send({
      from: env.RESEND_FROM_EMAIL,
      to: email,
      subject: `Code de vérification Dash Meal : ${code}`,
      html: `
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px;background:#0a0f1e;color:#fff;border-radius:12px;">
          <h2 style="color:#f97316;margin-bottom:8px;">Dash Meal</h2>
          <p style="color:#94a3b8;margin-bottom:24px;">Voici votre code de vérification pour accéder à votre espace administration.</p>
          <div style="background:#1e293b;border-radius:8px;padding:20px;text-align:center;letter-spacing:8px;font-size:32px;font-weight:700;color:#f97316;">
            ${code}
          </div>
          <p style="color:#64748b;font-size:13px;margin-top:20px;">Valable ${OTP_EXPIRES_IN_MINUTES} minutes. Ne partagez pas ce code.</p>
        </div>
      `,
    });

    if (error) {
      console.error("❌ Échec envoi email Resend:", error.message);
      return { code, emailSent: false };
    }

    console.log(`✅ Email OTP Resend envoyé à ${email}`);
    return { code, emailSent: true };
  } catch (err) {
    console.error("❌ Erreur réseau envoi email Resend:", err);
    return { code, emailSent: false };
  }
}
