import express, { type Application } from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import rateLimit from "express-rate-limit";

import { env } from "./config/env.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { API_PREFIX } from "@dash-meal/shared";
import { startStaleOrderNotifier } from "./services/staleOrderNotifier.js";

// Routes
import authRoutes from "./modules/auth/auth.routes.js";
import brandsRoutes from "./modules/brands/brands.routes.js";
import branchesRoutes from "./modules/branches/branches.routes.js";
import productsRoutes from "./modules/products/products.routes.js";
import ordersRoutes from "./modules/orders/orders.routes.js";
import paymentsRoutes from "./modules/payments/payments.routes.js";
import invoicesRoutes from "./modules/invoices/invoices.routes.js";
import chatRoutes from "./modules/chat/chat.routes.js";
import analyticsRoutes from "./modules/analytics/analytics.routes.js";
import cartRoutes from "./modules/cart/cart.routes.js";
import adminsRoutes from "./modules/admins/admins.routes.js";
import usersRoutes from "./modules/users/users.routes.js";
import collectRoutes from "./modules/collect/collect.routes.js";
import deliveryRoutes from "./modules/delivery/delivery.routes.js";
import notificationsRoutes from "./modules/notifications/notifications.routes.js";
import commissionsRoutes from "./modules/commissions/commissions.routes.js";
import documentsRoutes from "./modules/documents/documents.routes.js";
import auditRoutes from "./modules/audit/audit.routes.js";
import mapsRoutes from "./modules/maps/maps.routes.js";
import walletRoutes from "./modules/wallet/wallet.routes.js";

const app: Application = express();

// ─── Sécurité ─────────────────────────────────────────────────────────────────
app.use(helmet());
app.use(
  cors({
    origin: env.CORS_ORIGINS.split(",").map((o) => o.trim()),
    credentials: true,
  })
);

// ─── Rate limiting global ─────────────────────────────────────────────────────
app.use(
  rateLimit({
    windowMs: 4 * 60 * 1000, // 4 minutes
    max: 200,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, error: { code: "RATE_LIMIT", message: "Trop de requêtes" } },
  })
);

// ─── Rate limiting strict pour auth ──────────────────────────────────────────
const authLimiter = rateLimit({
  windowMs: 4 * 60 * 1000, // 4 minutes
  max: 20,
  message: { success: false, error: { code: "RATE_LIMIT", message: "Trop de tentatives" } },
});

// ─── Parsing ──────────────────────────────────────────────────────────────────
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

// ─── Logs ─────────────────────────────────────────────────────────────────────
if (env.NODE_ENV !== "test") {
  app.use(morgan(env.NODE_ENV === "production" ? "combined" : "dev"));
}

// ─── Health check ─────────────────────────────────────────────────────────────
app.get("/health", (_req, res) => {
  res.json({ status: "ok", env: env.NODE_ENV, timestamp: new Date().toISOString() });
});
app.get(`${API_PREFIX}/health`, (_req, res) => {
  res.json({ status: "ok", env: env.NODE_ENV, timestamp: new Date().toISOString() });
});

// ─── Routes API ───────────────────────────────────────────────────────────────
app.use(`${API_PREFIX}/auth`, authLimiter, authRoutes);
app.use(`${API_PREFIX}/brands`, brandsRoutes);
app.use(`${API_PREFIX}/branches`, branchesRoutes);
app.use(`${API_PREFIX}/products`, productsRoutes);
app.use(`${API_PREFIX}/orders`, ordersRoutes);
app.use(`${API_PREFIX}/payments`, paymentsRoutes);
app.use(`${API_PREFIX}/invoices`, invoicesRoutes);
app.use(`${API_PREFIX}/chat`, chatRoutes);
app.use(`${API_PREFIX}/analytics`, analyticsRoutes);
app.use(`${API_PREFIX}/cart`, cartRoutes);
app.use(`${API_PREFIX}/admins`, adminsRoutes);
app.use(`${API_PREFIX}/users`, usersRoutes);
app.use(`${API_PREFIX}/collect`, collectRoutes);
app.use(`${API_PREFIX}/delivery`, deliveryRoutes);
app.use(`${API_PREFIX}/notifications`, notificationsRoutes);
app.use(`${API_PREFIX}/commissions`, commissionsRoutes);
app.use(`${API_PREFIX}/documents`, documentsRoutes);
app.use(`${API_PREFIX}/audit`, auditRoutes);
app.use(`${API_PREFIX}/maps`,   mapsRoutes);
app.use(`${API_PREFIX}/wallet`, walletRoutes);

// ─── 404 ─────────────────────────────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({
    success: false,
    error: { code: "NOT_FOUND", message: "Route introuvable" },
  });
});

// ─── Gestionnaire d'erreurs global ───────────────────────────────────────────
app.use(errorHandler);

// ─── Démarrage du serveur ────────────────────────────────────────────────────
app.listen(env.PORT, () => {
  console.log(`🚀 Dash Meal Backend démarré sur le port ${env.PORT}`);
  console.log(`   Environnement : ${env.NODE_ENV}`);
  console.log(`   API : http://localhost:${env.PORT}${API_PREFIX}`);
  startStaleOrderNotifier();
});

export default app as Application;
