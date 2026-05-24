import type { Request, Response, NextFunction } from "express";
import * as svc from "./user-wallet.service.js";

// ── GET /user-wallet ──────────────────────────────────────────────────────────
export async function getMyWallet(req: Request, res: Response, next: NextFunction) {
  try {
    const wallet = await svc.getWallet(req.user!.id);
    res.json({ success: true, data: wallet });
  } catch (err) { next(err); }
}

// ── GET /user-wallet/card-numbers ─────────────────────────────────────────────
export async function generateCardNumbers(req: Request, res: Response, next: NextFunction) {
  try {
    const numbers = await svc.generateUniqueCardNumbers();
    res.json({ success: true, data: numbers });
  } catch (err) { next(err); }
}

// ── POST /user-wallet/activate ────────────────────────────────────────────────
export async function activateWallet(req: Request, res: Response, next: NextFunction) {
  try {
    const { card_number, pin, payment_phone, payment_method, initial_amount } = req.body;
    const { data: user } = await import("../../config/supabase.js").then(m =>
      m.supabase.from("users").select("name").eq("id", req.user!.id).single()
    );
    const result = await svc.initiateActivation({
      userId: req.user!.id,
      cardName: user?.name ?? req.user!.id,
      cardNumber: card_number,
      pin,
      paymentPhone: payment_phone,
      paymentMethod: payment_method,
      initialAmount: initial_amount,
    });
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
}

// ── POST /user-wallet/topup ───────────────────────────────────────────────────
export async function topUpWallet(req: Request, res: Response, next: NextFunction) {
  try {
    const wallet = await svc.getWallet(req.user!.id);
    if (!wallet) {
      res.status(404).json({ success: false, error: { code: "NO_WALLET", message: "Activez votre wallet d'abord" } });
      return;
    }
    const { amount, phone } = req.body;
    const result = await svc.initiateTopUp({ walletId: wallet.id, amount, phone });
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
}

// ── POST /user-wallet/verify-pin ──────────────────────────────────────────────
export async function verifyPinHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const wallet = await svc.getWallet(req.user!.id);
    if (!wallet) { res.status(404).json({ success: false, error: { code: "NO_WALLET", message: "Wallet introuvable" } }); return; }
    const ok = await svc.verifyPin(wallet.id, req.body.pin);
    res.json({ success: true, data: { valid: ok } });
  } catch (err) { next(err); }
}

// ── POST /user-wallet/transfer ────────────────────────────────────────────────
export async function transferHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const wallet = await svc.getWallet(req.user!.id);
    if (!wallet) { res.status(404).json({ success: false, error: { code: "NO_WALLET", message: "Wallet introuvable" } }); return; }
    const { identifier, amount } = req.body;
    const result = await svc.transferWallet({ fromWalletId: wallet.id, identifier, amount });
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
}

// ── POST /user-wallet/withdraw ────────────────────────────────────────────────
export async function withdrawHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const wallet = await svc.getWallet(req.user!.id);
    if (!wallet) { res.status(404).json({ success: false, error: { code: "NO_WALLET", message: "Wallet introuvable" } }); return; }
    const { amount, phone, phone_confirm } = req.body;
    const result = await svc.initiateWithdrawal({ walletId: wallet.id, amount, phone, phoneConfirm: phone_confirm });
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
}

// ── GET /user-wallet/transactions ─────────────────────────────────────────────
export async function getMyTransactions(req: Request, res: Response, next: NextFunction) {
  try {
    const wallet = await svc.getWallet(req.user!.id);
    if (!wallet) { res.json({ success: true, data: { transactions: [], pagination: { page:1, limit:20, total:0, total_pages:0 } } }); return; }
    const page  = Number(req.query.page)  || 1;
    const limit = Number(req.query.limit) || 20;
    const result = await svc.getTransactions(wallet.id, page, limit);
    res.json({ success: true, ...result });
  } catch (err) { next(err); }
}

// ── POST /user-wallet/shared-cart ─────────────────────────────────────────────
export async function createSharedCartHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const { data: user } = await import("../../config/supabase.js").then(m =>
      m.supabase.from("users").select("name").eq("id", req.user!.id).single()
    );
    const { data: branch } = await import("../../config/supabase.js").then(m =>
      m.supabase.from("branches").select("name").eq("id", req.body.branch_id).single()
    );
    const result = await svc.createSharedCart({
      ownerId: req.user!.id,
      ownerName: user?.name ?? "Utilisateur",
      branchId: req.body.branch_id,
      branchName: branch?.name ?? "Agence",
      items: req.body.items,
      orderType: req.body.order_type ?? "collect",
      promoId: req.body.promo_id,
      promoCode: req.body.promo_code,
      promoPct: req.body.promo_pct,
      subtotal: req.body.subtotal,
      discountAmount: req.body.discount_amount ?? 0,
      totalAmount: req.body.total_amount,
    });
    res.status(201).json({ success: true, data: result });
  } catch (err) { next(err); }
}

// ── GET /user-wallet/shared-cart/:token (public) ──────────────────────────────
export async function getSharedCartHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const cart = await svc.getSharedCart(String(req.params.token));
    res.json({ success: true, data: cart });
  } catch (err) { next(err); }
}

// ── Superadmin ────────────────────────────────────────────────────────────────

export async function getCommissionWallet(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await svc.getCommissionWallet();
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

export async function getAllTransactions(req: Request, res: Response, next: NextFunction) {
  try {
    const page  = Number(req.query.page)  || 1;
    const limit = Number(req.query.limit) || 50;
    const type  = req.query.type as string | undefined;
    const result = await svc.getAllUserTransactions(page, limit, type);
    res.json({ success: true, ...result });
  } catch (err) { next(err); }
}

export async function getCommissionTransactions(req: Request, res: Response, next: NextFunction) {
  try {
    const page  = Number(req.query.page)  || 1;
    const limit = Number(req.query.limit) || 50;
    const result = await svc.getCommissionTransactions(page, limit);
    res.json({ success: true, ...result });
  } catch (err) { next(err); }
}
