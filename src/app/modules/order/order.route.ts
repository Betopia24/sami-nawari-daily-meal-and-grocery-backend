import { UserRole } from "@prisma/client";
import express from "express";
import auth from "../../middlewares/auth";
import validateRequest from "../../middlewares/validateRequest";
import { OrderController } from "./order.controller";
import { orderValidation } from "./order.validation";

const router = express.Router();

// Admin Routes
router.get(
  "/admin/statistics",
  auth(UserRole.ADMIN),
  OrderController.getOrderStatistics
);

router.get(
  "/admin",
  auth(UserRole.ADMIN),
  OrderController.getAllOrders
);

router.get(
  "/admin/:id",
  auth(UserRole.ADMIN),
  OrderController.getAdminOrderById
);

router.patch(
  "/admin/:id/payment-status",
  auth(UserRole.ADMIN),
  validateRequest(orderValidation.updatePaymentStatusSchema),
  OrderController.adminUpdatePaymentStatus
);

// Seller Routes
router.get(
  "/seller",
  auth(UserRole.SELLER),
  OrderController.getSellerOrders
);

router.get(
  "/seller/:id",
  auth(UserRole.SELLER),
  OrderController.getSellerOrderById
);

router.patch(
  "/seller/:id/status",
  auth(UserRole.SELLER),
  validateRequest(orderValidation.updateStatusSchema),
  OrderController.updateOrderStatus
);

// Buyer Routes
router.get(
  "/",
  auth(UserRole.BUYER, UserRole.SELLER),
  OrderController.getMyOrders
);

router.get(
  "/:id",
  auth(UserRole.BUYER, UserRole.SELLER),
  OrderController.getOrderById
);

router.post(
  "/",
  auth(UserRole.BUYER, UserRole.SELLER),
  validateRequest(orderValidation.createOrderSchema),
  OrderController.createOrder
);

router.post(
  "/:id/reorder",
  auth(UserRole.BUYER),
  OrderController.reorderOrder
);

router.patch(
  "/:id/cancel",
  auth(UserRole.BUYER, UserRole.SELLER),
  OrderController.cancelOrder
);

export const OrderRoutes = router;
