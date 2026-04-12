import { Router } from "express";
import { authenticate, requireRole } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { z } from "zod";
import * as controller from "./users.controller.js";

const router: import("express").Router = Router();

const UpdateProfileSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  preferred_locale: z.enum(["fr", "en"]).optional(),
});

const ChangePasswordSchema = z.object({
  current_password: z.string().min(1),
  new_password: z.string().min(8).max(100),
});

const SavedAddressSchema = z.object({
  label: z.string().min(1).max(50),   // "Maison", "Bureau"...
  address: z.string().min(5).max(500),
  lat: z.number(),
  lng: z.number(),
  is_default: z.boolean().default(false),
});

// ─── Profil de l'utilisateur connecté ────────────────────────────────────────
router.get("/me", authenticate, requireRole("user"), controller.getMyProfile);
router.patch("/me", authenticate, requireRole("user"), validate(UpdateProfileSchema), controller.updateMyProfile);
router.post("/me/change-password", authenticate, requireRole("user"), validate(ChangePasswordSchema), controller.changePassword);

// ─── Adresses sauvegardées ────────────────────────────────────────────────────
router.get("/me/addresses", authenticate, requireRole("user"), controller.listAddresses);
router.post("/me/addresses", authenticate, requireRole("user"), validate(SavedAddressSchema), controller.addAddress);
router.patch("/me/addresses/:id", authenticate, requireRole("user"), validate(SavedAddressSchema.partial()), controller.updateAddress);
router.delete("/me/addresses/:id", authenticate, requireRole("user"), controller.deleteAddress);

// ─── Notifications ────────────────────────────────────────────────────────────
router.get("/me/notifications", authenticate, requireRole("user"), controller.getNotifications);
router.patch("/me/notifications/:id/read", authenticate, requireRole("user"), controller.markNotificationRead);
router.patch("/me/notifications/read-all", authenticate, requireRole("user"), controller.markAllNotificationsRead);

// ─── Token push (Expo) ───────────────────────────────────────────────────────
router.post("/me/push-token", authenticate, requireRole("user"), controller.registerPushToken);

// ─── Gestion utilisateurs (superadmin) ───────────────────────────────────────
router.get("/", authenticate, requireRole("superadmin"), controller.listUsers);
router.get("/:id", authenticate, requireRole("superadmin"), controller.getUserById);
router.patch("/:id/toggle-active", authenticate, requireRole("superadmin"), controller.toggleUserActive);

export default router;
