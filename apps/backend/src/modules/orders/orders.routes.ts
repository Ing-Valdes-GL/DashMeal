import { Router } from "express";
import { authenticate, requireRole } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import {
  CreateCollectOrderSchema,
  CreateDeliveryOrderSchema,
  CreateOrderSchema,
  UpdateOrderStatusSchema,
  AssignDriverSchema,
} from "@dash-meal/shared";
import * as controller from "./orders.controller.js";

const router: import("express").Router = Router();

// ─── Passer commande (unified — mobile) ──────────────────────────────────────
router.post("/", authenticate, requireRole("user"), validate(CreateOrderSchema), controller.createOrder);

// ─── Passer commande (legacy routes) ─────────────────────────────────────────
router.post("/collect", authenticate, requireRole("user"), validate(CreateCollectOrderSchema), controller.createCollectOrder);
router.post("/delivery", authenticate, requireRole("user"), validate(CreateDeliveryOrderSchema), controller.createDeliveryOrder);

// ─── Historique utilisateur ───────────────────────────────────────────────────
router.get("/my-orders", authenticate, requireRole("user"), controller.getUserOrders);
router.get("/:id", authenticate, controller.getOrder);

// ─── Gestion admin ────────────────────────────────────────────────────────────
router.get("/", authenticate, requireRole("admin", "superadmin", "driver"), controller.listOrders);
router.patch("/:id/status", authenticate, requireRole("admin", "superadmin"), validate(UpdateOrderStatusSchema), controller.updateOrderStatus);
router.post("/:id/assign-driver", authenticate, requireRole("admin", "superadmin"), validate(AssignDriverSchema), controller.assignDriver);
router.post("/:id/cancel", authenticate, controller.cancelOrder);

export default router;
