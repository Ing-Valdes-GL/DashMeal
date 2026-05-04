import { Router } from "express";
import { z } from "zod";
import { validate } from "../../middleware/validate.js";
import { authenticate, requireRole } from "../../middleware/auth.js";
import * as controller from "./branch-auth.controller.js";

const router = Router();

const LoginSchema = z.object({
  phone:    z.string().min(8),
  password: z.string().min(6),
});

const RefreshSchema = z.object({
  refresh_token: z.string().min(1),
});

const PasswordSchema = z.object({
  current_password: z.string().min(6),
  new_password:     z.string().min(6),
});

router.post("/login",   validate(LoginSchema),   controller.loginBranchManager);
router.post("/refresh", validate(RefreshSchema),  controller.refreshBranchToken);
router.get( "/me",      authenticate, requireRole("branch_manager"), controller.getBranchManagerMe);
router.patch("/me/password", authenticate, requireRole("branch_manager"), validate(PasswordSchema), controller.updateBranchManagerPassword);

export default router;
