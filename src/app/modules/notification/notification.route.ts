import { UserRole } from "@prisma/client";
import express from "express";
import auth from "../../middlewares/auth";
import { NotificationController } from "./notification.controller";

const router = express.Router();

router.get(
  "/",
  auth(UserRole.BUYER, UserRole.SELLER, UserRole.ADMIN),
  NotificationController.getMyNotifications
);

router.patch(
  "/read-all",
  auth(UserRole.BUYER, UserRole.SELLER, UserRole.ADMIN),
  NotificationController.markAllAsRead
);

router.patch(
  "/:id/read",
  auth(UserRole.BUYER, UserRole.SELLER, UserRole.ADMIN),
  NotificationController.markAsRead
);

export const NotificationRoutes = router;
