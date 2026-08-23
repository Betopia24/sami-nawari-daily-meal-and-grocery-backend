import { UserRole } from "@prisma/client";
import express from "express";
import auth from "../../middlewares/auth";
import validateRequest from "../../middlewares/validateRequest";
import { OrderController } from "./order.controller";
import { orderValidation } from "./order.validation";

const router = express.Router();

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

router.patch(
  "/:id/cancel",
  auth(UserRole.BUYER, UserRole.SELLER),
  OrderController.cancelOrder
);

export const OrderRoutes = router;
