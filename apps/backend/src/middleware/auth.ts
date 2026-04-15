import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import type { AuthUser } from "@dash-meal/shared";

// Augmenter le type Request pour inclure l'utilisateur authentifié
declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export function authenticate(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    res.status(401).json({
      success: false,
      error: { code: "UNAUTHORIZED", message: "Token manquant" },
    });
    return;
  }

  const token = authHeader.slice(7);
  try {
    const payload = jwt.verify(token, env.JWT_SECRET) as AuthUser;
    req.user = payload;
    next();
  } catch {
    res.status(401).json({
      success: false,
      error: { code: "INVALID_TOKEN", message: "Token invalide ou expiré" },
    });
  }
}

export function requireRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: { code: "UNAUTHORIZED", message: "Non authentifié" },
      });
      return;
    }
    if (!roles.includes(req.user.role)) {
      res.status(403).json({
        success: false,
        error: { code: "FORBIDDEN", message: "Accès refusé" },
      });
      return;
    }
    next();
  };
}

// Auth optionnelle — attache req.user si token présent, passe sinon
export function optionalAuthenticate(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) return next();
  const token = authHeader.slice(7);
  try {
    const payload = jwt.verify(token, env.JWT_SECRET) as AuthUser;
    req.user = payload;
  } catch {
    // token invalide → on ignore simplement
  }
  next();
}

// Vérifie que l'admin accède uniquement à sa propre marque
export function requireOwnBrand(req: Request, res: Response, next: NextFunction) {
  const brandId = req.params.brandId ?? req.body.brand_id;
  if (req.user?.role === "superadmin") {
    // Le superadmin peut tout voir
    next();
    return;
  }
  if (req.user?.brand_id !== brandId) {
    res.status(403).json({
      success: false,
      error: { code: "FORBIDDEN", message: "Accès à cette marque refusé" },
    });
    return;
  }
  next();
}
