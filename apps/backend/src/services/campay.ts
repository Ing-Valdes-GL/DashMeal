/**
 * CamPay Payment Service
 *
 * API reference: https://documenter.getpostman.com/view/2391374/T1LV8PVA
 * Sandbox: https://demo.campay.net/
 * Production: https://www.campay.net/
 *
 * All endpoints are prefixed with /api/
 * Authentication: POST /api/token/ → { token, expiresIn }
 * Authorization header: "Token {token}"
 */

import { env } from "../config/env.js";
import { AppError } from "../middleware/errorHandler.js";

// ─── Types ────────────────────────────────────────────────────────────────────

export type CamPayStatus = "SUCCESSFUL" | "FAILED" | "PENDING";

export interface CamPayCollectResponse {
  reference: string;
  ussd_code?: string;
  operator?: string; // "MTN" | "Orange"
}

export interface CamPayTransactionStatus {
  reference: string;
  status: CamPayStatus;
  amount: number;
  currency: string;
  operator: string;
  code: string;
  operator_reference: string;
}

export interface CamPayBalanceResponse {
  total_balance: number;
  mtn_balance: number;
  orange_balance: number;
  currency: string;
}

export interface CamPayWithdrawResponse {
  reference: string;
  status: string;
  operator?: string;
}

// ─── Operator detection & minimums ───────────────────────────────────────────

/**
 * Cameroon mobile prefixes (9-digit local format, first 3 digits):
 *   MTN:    650-654, 658-659, 670-679, 680-689
 *   Orange: 655-657, 690-699
 */
function detectOperator(phone: string): "MTN" | "Orange" | "unknown" {
  const digits = normalizePhone(phone); // 237XXXXXXXXX
  // Extract the 3 digits after country code 237 (positions 3-5)
  const prefix = parseInt(digits.slice(3, 6), 10);
  if (isNaN(prefix)) return "unknown";

  if (
    (prefix >= 650 && prefix <= 654) ||
    (prefix >= 658 && prefix <= 659) ||
    (prefix >= 670 && prefix <= 689)
  ) return "MTN";

  if (
    (prefix >= 655 && prefix <= 657) ||
    (prefix >= 690 && prefix <= 699)
  ) return "Orange";

  return "unknown";
}

const CAMPAY_MIN_AMOUNT: Record<"MTN" | "Orange" | "unknown", number> = {
  MTN:     100, // MTN Mobile Money minimum
  Orange:   10, // Orange Money minimum
  unknown: 100, // conservative fallback
};

// ─── Token cache (module-level singleton) ────────────────────────────────────

interface TokenCache {
  token: string;
  expiresAt: number; // timestamp ms
}

let _tokenCache: TokenCache | null = null;

function baseUrl(): string {
  return env.CAMPAY_BASE_URL.replace(/\/$/, "");
}

// ─── Auth ─────────────────────────────────────────────────────────────────────

async function getToken(): Promise<string> {
  const now = Date.now();

  // Reuse cached token if it has more than 60s remaining
  if (_tokenCache && _tokenCache.expiresAt > now + 60_000) {
    return _tokenCache.token;
  }

  const res = await fetch(`${baseUrl()}/api/token/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      username: env.CAMPAY_APP_USERNAME,
      password: env.CAMPAY_APP_PASSWORD,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`CamPay auth failed (${res.status}): ${body}`);
  }

  const data = await res.json() as { token: string; expiresIn?: number };
  const ttl = (data.expiresIn ?? 3600) * 1000; // default 1h
  _tokenCache = { token: data.token, expiresAt: now + ttl };
  return data.token;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Normalise un numéro de téléphone au format CamPay : 237XXXXXXXXX
 * Gère les cas :
 *   +237690123456  → 237690123456
 *   00237690123456 → 237690123456
 *   237690123456   → 237690123456  (déjà bon)
 *   690123456      → 237690123456  (numéro local Cameroun 9 chiffres)
 */
function normalizePhone(phone: string): string {
  // Supprimer tout sauf les chiffres
  const digits = phone.replace(/\D/g, "");

  // 00237... → supprimer le 00
  if (digits.startsWith("00237")) return digits.slice(2);

  // Déjà au bon format 237 + 9 chiffres = 12 chiffres
  if (digits.startsWith("237") && digits.length === 12) return digits;

  // Numéro local : 9 chiffres commençant par 6, 7, 8 ou 9 (Cameroun)
  if (digits.length === 9 && /^[6789]/.test(digits)) return `237${digits}`;

  // Numéro avec indicatif sans le + : ex 237690... mais longueur différente
  if (digits.startsWith("237")) return digits;

  // Fallback : retourner tel quel (laisse CamPay rejeter si vraiment invalide)
  return digits;
}

async function authHeader(): Promise<{ Authorization: string; "Content-Type": string }> {
  const token = await getToken();
  return {
    "Content-Type": "application/json",
    Authorization: `Token ${token}`,
  };
}

// ─── API calls ────────────────────────────────────────────────────────────────

/**
 * Initiate a Mobile Money collection (debit the customer).
 * Campay sends a USSD push notification to the customer's phone.
 */
export async function campayCollect(params: {
  amount: number;
  phone: string;
  description: string;
  externalReference: string;
  paymentMethod?: string; // e.g. "orange_money" | "mtn_mobile_money" | "mobile_money"
}): Promise<CamPayCollectResponse> {
  // Trust explicit payment method selection over phone-prefix detection
  let operator: "MTN" | "Orange" | "unknown";
  if (params.paymentMethod === "orange_money") {
    operator = "Orange";
  } else if (params.paymentMethod === "mtn_mobile_money") {
    operator = "MTN";
  } else {
    operator = detectOperator(params.phone);
  }
  const minAmount = CAMPAY_MIN_AMOUNT[operator];

  if (params.amount < minAmount) {
    const operatorLabel = operator === "unknown" ? "Mobile Money" : `${operator} Mobile Money`;
    throw new AppError(
      400,
      "AMOUNT_TOO_LOW",
      `Le montant minimum pour ${operatorLabel} est de ${minAmount} FCFA. Montant actuel : ${params.amount} FCFA.`,
    );
  }

  const headers = await authHeader();

  const res = await fetch(`${baseUrl()}/api/collect/`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      amount: String(params.amount),
      currency: "XAF",
      from: normalizePhone(params.phone),
      description: params.description,
      external_reference: params.externalReference,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    try {
      const errJson = JSON.parse(body) as { message?: string; error_code?: string };
      if (errJson.message) {
        throw new AppError(400, "CAMPAY_ERROR", errJson.message);
      }
    } catch (parseErr) {
      if (parseErr instanceof SyntaxError) { /* corps non-JSON */ }
      else throw parseErr;
    }
    throw new AppError(502, "CAMPAY_ERROR", `Échec du paiement Mobile Money (${res.status})`);
  }

  return res.json() as Promise<CamPayCollectResponse>;
}

/**
 * Check the status of a transaction by its reference.
 * Poll this until status is SUCCESSFUL or FAILED.
 */
export async function campayTransactionStatus(
  reference: string,
): Promise<CamPayTransactionStatus> {
  const headers = await authHeader();

  const res = await fetch(`${baseUrl()}/api/transaction/${reference}/`, {
    method: "GET",
    headers,
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`CamPay status check failed (${res.status}): ${body}`);
  }

  return res.json() as Promise<CamPayTransactionStatus>;
}

/**
 * Disburse money to a phone number (requires withdrawal enabled in CamPay dashboard).
 * Used for refunds or driver payouts.
 */
export async function campayWithdraw(params: {
  amount: number;
  phone: string;
  description: string;
  externalReference: string;
}): Promise<CamPayWithdrawResponse> {
  const headers = await authHeader();

  const res = await fetch(`${baseUrl()}/api/withdraw/`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      amount: String(params.amount),
      to: normalizePhone(params.phone),
      description: params.description,
      external_reference: params.externalReference,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`CamPay withdraw failed (${res.status}): ${body}`);
  }

  return res.json() as Promise<CamPayWithdrawResponse>;
}

/**
 * Get current wallet balance (total, MTN, Orange).
 */
export async function campayBalance(): Promise<CamPayBalanceResponse> {
  const headers = await authHeader();

  const res = await fetch(`${baseUrl()}/api/balance/`, {
    method: "GET",
    headers,
  });

  if (!res.ok) {
    throw new Error(`CamPay balance check failed (${res.status})`);
  }

  return res.json() as Promise<CamPayBalanceResponse>;
}
