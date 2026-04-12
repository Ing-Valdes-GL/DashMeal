import { Router } from "express";
import { authenticate } from "../../middleware/auth.js";
import * as controller from "./chat.controller.js";

const router: import("express").Router = Router();

router.get("/conversations/:orderId", authenticate, controller.getConversations);
router.get("/conversations/:conversationId/messages", authenticate, controller.getMessages);
router.post("/conversations/:conversationId/messages", authenticate, controller.sendMessage);
router.patch("/conversations/:conversationId/read", authenticate, controller.markAsRead);

export default router;
