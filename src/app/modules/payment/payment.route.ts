import { UserRole } from "@prisma/client";
import express from "express";
import auth from "../../middlewares/auth";
import { PaymentController } from "./payemnt.controller";

const router = express.Router();

router.post(
  "/create-checkout-session",
  auth(UserRole.BUYER, UserRole.SELLER),
  PaymentController.createCheckoutSession
);

export const PaymentRoutes = router;
