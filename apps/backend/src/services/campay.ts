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
}): Promise<CamPayCollectResponse> {
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
    throw new Error(`CamPay collect failed (${res.status}): ${body}`);
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
