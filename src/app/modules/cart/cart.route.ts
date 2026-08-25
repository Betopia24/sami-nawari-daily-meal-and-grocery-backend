import { UserRole } from "@prisma/client";
import express from "express";
import auth from "../../middlewares/auth";
import validateRequest from "../../middlewares/validateRequest";
import { CartController } from "./cart.controller";
import { cartValidation } from "./cart.validation";

const router = express.Router();
const cartAuth = auth(UserRole.BUYER, UserRole.SELLER);

router.get(
  "/",
  cartAuth,
  CartController.getCart
);

router.post(
  "/",
  cartAuth,
  validateRequest(cartValidation.addToCartSchema),
  CartController.addItemToCart
);

router.patch(
  "/quantity",
  cartAuth,
  validateRequest(cartValidation.updateQuantitySchema),
  CartController.updateItemQuantity
);

router.delete(
  "/:foodId",
  cartAuth,
  CartController.removeItemFromCart
);

router.delete(
  "/",
  cartAuth,
  CartController.clearCart
);

export const CartRoutes = router;
