import { UserRole } from "@prisma/client";
import express from "express";
import auth from "../../middlewares/auth";
import validateRequest from "../../middlewares/validateRequest";
import { PaymentController } from "./payemnt.controller";
import { paymentValidation } from "./payment.validation";

const router = express.Router();

router.post(
  "/create-checkout-session",
  auth(UserRole.BUYER, UserRole.SELLER),
  validateRequest(paymentValidation.createCheckoutSessionSchema),
  PaymentController.createCheckoutSession
);

router.post(
  "/retry-payment/:orderId",
  auth(UserRole.BUYER, UserRole.SELLER),
  PaymentController.retryPayment
);

router.post(
  "/retry",
  auth(UserRole.BUYER, UserRole.SELLER),
  validateRequest(paymentValidation.retryPaymentSchema),
  PaymentController.retryPayment
);

router.get("/success", PaymentController.renderPaymentSuccess);
router.get("/cancel", PaymentController.renderPaymentCancel);

export const PaymentRoutes = router;
