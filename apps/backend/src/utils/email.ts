import { Resend } from "resend";
import { supabase } from "../config/supabase.js";
import { OTP_EXPIRES_IN_MINUTES, OTP_LENGTH } from "@dash-meal/shared";
import { env } from "../config/env.js";

function resendClient() {
  return new Resend(env.RESEND_API_KEY);
}

function canSendEmail(): boolean {
  return !!env.RESEND_API_KEY;
}

/** Send Click & Collect confirmation email with QR code */
export async function sendCollectQrEmail(opts: {
  to: string;
  customerName: string;
  orderId: string;
  qrToken: string;
  qrImageDataUrl: string;
  numericCode: string;
  branchName: string;
  slotDate: string;
  slotTime: string;
  total: number;
}): Promise<void> {
  if (!canSendEmail()) { console.warn("⚠️  RESEND_API_KEY manquant — QR email non envoyé"); return; }
  try {
    const { error } = await resendClient().emails.send({
      from: env.RESEND_FROM_EMAIL,
      to: opts.to,
      subject: `Votre QR Code Click & Collect — Dash Meal #${opts.orderId.slice(0, 8).toUpperCase()}`,
      html: `
        <div style="font-family:sans-serif;max-width:520px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;border:1px solid #e2e8f0;">
          <div style="background:#0f172a;padding:28px 32px;">
            <h1 style="color:#f97316;margin:0;font-size:22px;">Dash Meal</h1>
            <p style="color:#94a3b8;margin:6px 0 0;font-size:14px;">Confirmation Click & Collect</p>
          </div>
          <div style="padding:32px;">
            <p style="color:#1e293b;font-size:15px;margin:0 0 8px;">Bonjour <strong>${opts.customerName}</strong>,</p>
            <p style="color:#475569;font-size:14px;margin:0 0 24px;">Votre commande est confirmée. Présentez ce QR code lors de votre retrait.</p>

            <div style="background:#f8fafc;border-radius:12px;padding:24px;text-align:center;border:1px solid #e2e8f0;margin-bottom:24px;">
              <img src="${opts.qrImageDataUrl}" alt="QR Code" style="width:200px;height:200px;display:block;margin:0 auto 16px;" />
              <p style="margin:0;color:#64748b;font-size:12px;text-transform:uppercase;letter-spacing:1px;">Code de secours</p>
              <p style="margin:8px 0 0;font-size:28px;font-weight:700;color:#0f172a;letter-spacing:8px;">${opts.numericCode}</p>
            </div>

            <div style="background:#f1f5f9;border-radius:10px;padding:16px;margin-bottom:24px;">
              <table style="width:100%;border-collapse:collapse;">
                <tr><td style="color:#64748b;font-size:13px;padding:4px 0;">Commande</td><td style="color:#0f172a;font-weight:600;font-size:13px;text-align:right;">#${opts.orderId.slice(0, 8).toUpperCase()}</td></tr>
                <tr><td style="color:#64748b;font-size:13px;padding:4px 0;">Agence</td><td style="color:#0f172a;font-weight:600;font-size:13px;text-align:right;">${opts.branchName}</td></tr>
                <tr><td style="color:#64748b;font-size:13px;padding:4px 0;">Date</td><td style="color:#0f172a;font-weight:600;font-size:13px;text-align:right;">${opts.slotDate}</td></tr>
                <tr><td style="color:#64748b;font-size:13px;padding:4px 0;">Créneau</td><td style="color:#0f172a;font-weight:600;font-size:13px;text-align:right;">${opts.slotTime}</td></tr>
                <tr><td style="color:#64748b;font-size:13px;padding:4px 0;border-top:1px solid #cbd5e1;padding-top:12px;margin-top:8px;">Total</td><td style="color:#f97316;font-weight:700;font-size:16px;text-align:right;border-top:1px solid #cbd5e1;padding-top:12px;">${opts.total.toLocaleString("fr-FR")} FCFA</td></tr>
              </table>
            </div>

            <p style="color:#94a3b8;font-size:12px;margin:0;">Conservez cet email — il est votre ticket de retrait. L'agence scannera le QR ou saisira le code à 6 chiffres.</p>
          </div>
        </div>
      `,
    });
    if (error) console.error("❌ Échec QR email:", error.message);
    else console.log(`✅ QR email envoyé à ${opts.to}`);
  } catch (err) {
    console.error("❌ QR email error:", err);
  }
}

/** Notify admin that a branch requested live approval */
export async function sendBranchLiveRequestEmail(opts: {
  adminEmail: string;
  adminName: string;
  branchName: string;
  branchEmail: string;
}): Promise<void> {
  if (!canSendEmail()) return;
  try {
    await resendClient().emails.send({
      from: env.RESEND_FROM_EMAIL,
      to: opts.adminEmail,
      subject: `Demande de mise en ligne — ${opts.branchName}`,
      html: `
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto;background:#fff;border-radius:16px;border:1px solid #e2e8f0;overflow:hidden;">
          <div style="background:#0f172a;padding:24px 28px;"><h1 style="color:#f97316;margin:0;font-size:20px;">Dash Meal</h1></div>
          <div style="padding:28px;">
            <p style="color:#1e293b;font-size:15px;margin:0 0 12px;">Bonjour <strong>${opts.adminName}</strong>,</p>
            <p style="color:#475569;font-size:14px;">L'agence <strong>${opts.branchName}</strong> (${opts.branchEmail}) demande à passer en mode <strong>Live</strong>.</p>
            <p style="color:#475569;font-size:14px;">Connectez-vous au panneau d'administration pour vérifier la configuration et approuver ou rejeter la demande.</p>
            <a href="${process.env.ADMIN_URL ?? "#"}" style="display:inline-block;margin-top:16px;background:#f97316;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600;font-size:14px;">Voir la demande</a>
          </div>
        </div>
      `,
    });
  } catch {}
}

/** Notify branch that admin approved/rejected their live request */
export async function sendBranchLiveDecisionEmail(opts: {
  to: string;
  branchName: string;
  approved: boolean;
  reason?: string;
}): Promise<void> {
  if (!canSendEmail()) return;
  try {
    await resendClient().emails.send({
      from: env.RESEND_FROM_EMAIL,
      to: opts.to,
      subject: opts.approved
        ? `✅ Votre agence ${opts.branchName} est maintenant en ligne !`
        : `❌ Demande de mise en ligne refusée — ${opts.branchName}`,
      html: `
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto;background:#fff;border-radius:16px;border:1px solid #e2e8f0;overflow:hidden;">
          <div style="background:${opts.approved ? "#16a34a" : "#dc2626"};padding:24px 28px;">
            <h1 style="color:#fff;margin:0;font-size:20px;">${opts.approved ? "🎉 Félicitations !" : "Demande refusée"}</h1>
          </div>
          <div style="padding:28px;">
            ${opts.approved
              ? `<p style="color:#1e293b;font-size:15px;">L'agence <strong>${opts.branchName}</strong> est maintenant <strong>Live</strong> sur Dash Meal. Vos clients peuvent désormais passer des commandes.</p>`
              : `<p style="color:#1e293b;font-size:15px;">La demande de mise en ligne de l'agence <strong>${opts.branchName}</strong> a été refusée.</p>${opts.reason ? `<div style="background:#fef2f2;border-radius:8px;padding:12px;margin-top:12px;"><p style="color:#dc2626;font-size:14px;margin:0;"><strong>Raison :</strong> ${opts.reason}</p></div>` : ""}<p style="color:#475569;font-size:14px;margin-top:16px;">Corrigez les points soulevés et soumettez une nouvelle demande.</p>`
            }
          </div>
        </div>
      `,
    });
  } catch {}
}

/** Notify superadmin that a brand submitted legal documents */
export async function sendLegalDocsSubmittedEmail(opts: {
  brandName: string;
  adminEmail: string;
}): Promise<void> {
  if (!canSendEmail()) return;
  try {
    await resendClient().emails.send({
      from: env.RESEND_FROM_EMAIL,
      to: process.env.SUPERADMIN_EMAIL ?? env.RESEND_FROM_EMAIL,
      subject: `Documents légaux soumis — ${opts.brandName}`,
      html: `<div style="font-family:sans-serif;padding:24px;"><h2>Documents légaux</h2><p>La marque <strong>${opts.brandName}</strong> (${opts.adminEmail}) vient de soumettre ses documents légaux pour vérification.</p></div>`,
    });
  } catch {}
}

/** Notify brand admin that legal docs were approved/rejected */
export async function sendLegalDocsDecisionEmail(opts: {
  to: string;
  brandName: string;
  approved: boolean;
  reason?: string;
}): Promise<void> {
  if (!canSendEmail()) return;
  try {
    await resendClient().emails.send({
      from: env.RESEND_FROM_EMAIL,
      to: opts.to,
      subject: opts.approved
        ? `✅ Documents légaux approuvés — ${opts.brandName}`
        : `❌ Documents légaux refusés — ${opts.brandName}`,
      html: `
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:28px;">
          <h2 style="color:${opts.approved ? "#16a34a" : "#dc2626"};">${opts.approved ? "Documents approuvés" : "Documents refusés"}</h2>
          <p>${opts.approved
            ? `Les documents légaux de <strong>${opts.brandName}</strong> ont été vérifiés et approuvés par Dash Meal.`
            : `Les documents légaux de <strong>${opts.brandName}</strong> ont été refusés.${opts.reason ? ` Raison : ${opts.reason}` : ""} Veuillez les corriger et soumettre à nouveau.`
          }</p>
        </div>
      `,
    });
  } catch {}
}

function generateCode(): string {
  return Math.floor(
    Math.pow(10, OTP_LENGTH - 1) +
    Math.random() * 9 * Math.pow(10, OTP_LENGTH - 1)
  )
    .toString()
    .padStart(OTP_LENGTH, "0");
}

export async function sendCodeByEmail(email: string, code: string): Promise<boolean> {
  if (!env.RESEND_API_KEY) {
    console.warn("⚠️  RESEND_API_KEY manquant — email de confirmation non envoyé");
    return false;
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
          <p style="color:#94a3b8;margin-bottom:24px;">Voici votre code de vérification. Utilisez-le dans l'application pour confirmer votre numéro.</p>
          <div style="background:#1e293b;border-radius:8px;padding:20px;text-align:center;letter-spacing:8px;font-size:32px;font-weight:700;color:#f97316;">
            ${code}
          </div>
          <p style="color:#64748b;font-size:13px;margin-top:20px;">Valable ${OTP_EXPIRES_IN_MINUTES} minutes. Ne partagez pas ce code.</p>
        </div>
      `,
    });
    if (error) {
      console.error("❌ Échec envoi email Resend:", error.message);
      return false;
    }
    console.log(`✅ Email OTP Resend envoyé à ${email}`);
    return true;
  } catch (err) {
    console.error("❌ Erreur réseau envoi email Resend:", err);
    return false;
  }
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
