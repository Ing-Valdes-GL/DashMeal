import { Router } from "express";
import { authenticate, requireRole } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { InitiatePaymentSchema, RecordInPersonPaymentSchema, CreateOrderSchema } from "@dash-meal/shared";
import * as controller from "./payments.controller.js";

const router: import("express").Router = Router();

// ─── Nouveau flux : payer d'abord, commande créée après confirmation ──────────
router.post("/initiate-order", authenticate, requireRole("user"), validate(CreateOrderSchema), controller.initiateOrderPayment);

// ─── Paiement en ligne sur commande existante ─────────────────────────────────
router.post("/initiate", authenticate, requireRole("user"), validate(InitiatePaymentSchema), controller.initiatePayment);
router.post("/webhook/campay", controller.campayWebhook); // webhook public (signature vérifiée)

// ─── Paiement en présentiel (enregistré par l'admin/caissier) ────────────────
router.post("/inperson", authenticate, requireRole("admin", "superadmin"), validate(RecordInPersonPaymentSchema), controller.recordInPersonPayment);

// ─── Statut temps réel (polling mobile) ───────────────────────────────────────
router.get("/status/:reference", authenticate, requireRole("user"), controller.getPaymentStatus);

// ─── Historique ───────────────────────────────────────────────────────────────
router.get("/order/:orderId", authenticate, controller.getPaymentByOrder);

// ─── Solde Campay (superadmin) ────────────────────────────────────────────────
router.get("/balance", authenticate, requireRole("superadmin"), controller.getCampayBalance);

export default router;
