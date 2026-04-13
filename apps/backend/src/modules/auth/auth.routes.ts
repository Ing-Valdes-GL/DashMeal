import { Router } from "express";
import { validate } from "../../middleware/validate.js";
import {
  RegisterUserSchema,
  LoginUserSchema,
  VerifyOtpSchema,
  ResetPasswordSchema,
  LoginAdminSchema,
  RefreshTokenSchema,
} from "@dash-meal/shared";
import * as controller from "./auth.controller.js";
import { z } from "zod";

const router: import("express").Router = Router();

// ─── Utilisateur (mobile) ─────────────────────────────────────────────────────
router.post("/user/register", validate(RegisterUserSchema), controller.registerUser);
router.post("/user/verify-phone", validate(VerifyOtpSchema), controller.verifyPhone);
router.post("/user/login", validate(LoginUserSchema), controller.loginUser);
router.post("/user/request-reset", validate(z.object({ phone: z.string().min(8) })), controller.requestReset);
router.post("/user/reset-password", validate(ResetPasswordSchema), controller.resetPassword);

// ─── Admin (marque) ───────────────────────────────────────────────────────────
router.post("/admin/login", validate(LoginAdminSchema), controller.loginAdmin);

// ─── Super Admin ──────────────────────────────────────────────────────────────
router.post(
  "/superadmin/register",
  validate(
    z.object({
      email: z.string().email(),
      phone: z.string().regex(/^\+?[1-9]\d{7,14}$/),
      password: z.string().min(8),
    })
  ),
  controller.registerSuperAdmin
);
router.post("/superadmin/login", validate(LoginAdminSchema), controller.loginSuperAdmin);

// ─── Commun ───────────────────────────────────────────────────────────────────
router.post("/refresh", validate(RefreshTokenSchema), controller.refreshTokens);

export default router;
