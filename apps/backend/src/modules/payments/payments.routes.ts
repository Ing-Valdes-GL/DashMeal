import { Router } from "express";
import { authenticate, requireRole } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { InitiatePaymentSchema, RecordInPersonPaymentSchema } from "@dash-meal/shared";
import * as controller from "./payments.controller.js";

const router: import("express").Router = Router();

// ─── Paiement en ligne (Mobile Money) ────────────────────────────────────────
router.post("/initiate", authenticate, requireRole("user"), validate(InitiatePaymentSchema), controller.initiatePayment);
router.post("/webhook/campay", controller.campayWebhook); // webhook public (signature vérifiée)

// ─── Paiement en présentiel (enregistré par l'admin/caissier) ────────────────
router.post("/inperson", authenticate, requireRole("admin", "superadmin"), validate(RecordInPersonPaymentSchema), controller.recordInPersonPayment);

// ─── Historique ───────────────────────────────────────────────────────────────
router.get("/order/:orderId", authenticate, controller.getPaymentByOrder);

export default router;
