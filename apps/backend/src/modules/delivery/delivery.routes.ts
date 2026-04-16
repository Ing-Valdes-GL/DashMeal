import { Router } from "express";
import { authenticate, requireRole } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { z } from "zod";
import * as controller from "./delivery.controller.js";

const router: import("express").Router = Router();

const UpdateDeliveryStatusSchema = z.object({
  status: z.enum(["picked_up", "on_the_way", "delivered", "failed"]),
  note: z.string().max(500).optional(),
});

const UpdatePositionSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

// ─── Livreur : profil ─────────────────────────────────────────────────────────
router.get("/me", authenticate, requireRole("driver"), controller.getDriverProfile);

// ─── Livreur : ses livraisons assignées ──────────────────────────────────────
router.get("/my-deliveries", authenticate, requireRole("driver"), controller.getMyDeliveries);
router.get("/my-deliveries/:id", authenticate, requireRole("driver"), controller.getDeliveryDetail);

// ─── Livreur : mettre à jour statut ──────────────────────────────────────────
router.patch("/:id/status", authenticate, requireRole("driver", "admin", "superadmin"), validate(UpdateDeliveryStatusSchema), controller.updateDeliveryStatus);

// ─── Livreur : partager sa position en temps réel ────────────────────────────
router.post("/:id/position", authenticate, requireRole("driver"), validate(UpdatePositionSchema), controller.updateDriverPosition);

// ─── Utilisateur : suivre sa livraison ───────────────────────────────────────
router.get("/track/:orderId", authenticate, requireRole("user"), controller.trackDelivery);

// ─── Admin : vue de toutes les livraisons de ses agences ─────────────────────
router.get("/", authenticate, requireRole("admin", "superadmin"), controller.listDeliveries);

export default router;
