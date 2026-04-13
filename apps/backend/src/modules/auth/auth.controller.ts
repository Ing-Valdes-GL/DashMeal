import type { Request, Response, NextFunction } from "express";
import * as authService from "./auth.service.js";

export async function registerUser(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await authService.registerUser(req.body);
    res.status(201).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

export async function verifyPhone(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await authService.verifyUserPhone(req.body);
    res.status(200).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

export async function loginUser(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await authService.loginUser(req.body);
    res.status(200).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

export async function loginAdmin(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await authService.loginAdmin(req.body);
    res.status(200).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

export async function loginSuperAdmin(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await authService.loginSuperAdmin(req.body);
    res.status(200).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

export async function registerSuperAdmin(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await authService.registerSuperAdmin(req.body);
    res.status(201).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

export async function refreshTokens(req: Request, res: Response, next: NextFunction) {
  try {
    const { refresh_token } = req.body;
    const tokens = await authService.refreshTokens(refresh_token);
    res.status(200).json({ success: true, data: tokens });
  } catch (err) {
    next(err);
  }
}

export async function requestReset(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await authService.requestPasswordReset(req.body.phone);
    res.status(200).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

export async function resetPassword(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await authService.resetPassword(req.body);
    res.status(200).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}
