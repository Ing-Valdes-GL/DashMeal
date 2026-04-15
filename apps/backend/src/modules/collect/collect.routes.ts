import { Router } from "express";
import { authenticate, requireRole } from "../../middleware/auth.js";
import * as controller from "./collect.controller.js";

const router: import("express").Router = Router();

// ─── Créneaux disponibles (public) ───────────────────────────────────────────
router.get("/slots/:branchId", controller.getSlots);

// ─── Côté caisse / admin : scanner le QR code pour valider le retrait ─────────
router.post("/scan", authenticate, requireRole("admin", "superadmin"), controller.scanQrCode);

// ─── Côté utilisateur : voir son QR code pour une commande ───────────────────
router.get("/order/:orderId", authenticate, requireRole("user"), controller.getCollectDetails);

// ─── Lister les commandes click & collect d'une agence (par jour/statut) ─────
router.get("/branch/:branchId", authenticate, requireRole("admin", "superadmin"), controller.listBranchCollects);

export default router;
