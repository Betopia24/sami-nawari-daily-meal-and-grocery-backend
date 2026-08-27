import { UserRole } from "@prisma/client";
import express from "express";
import auth from "../../middlewares/auth";
import validateRequest from "../../middlewares/validateRequest";
import { fileUpload } from "../../utils/fileUpload";
import { FoodController } from "./food.controller";
import { foodValidation } from "./food.validation";

const router = express.Router();

//* ─── Customer Routes (public) ───────────────────────────────────────────────

router.get(
  "/",
  FoodController.getPublishedFoods
);

//* ─── Seller Routes ───────────────────────────────────────────────────────────

router.get(
  "/seller",
  auth(UserRole.SELLER),
  FoodController.getSellerFoods
);

router.get(
  "/seller/:id",
  auth(UserRole.SELLER),
  FoodController.getSellerFoodDetails
);

router.post(
  "/",
  auth(UserRole.SELLER),
  fileUpload.upload.any(),
  FoodController.createFood
);

router.patch(
  "/seller/:id",
  auth(UserRole.SELLER),
  fileUpload.upload.any(),
  FoodController.updateSellerFood
);

router.delete(
  "/seller/:id",
  auth(UserRole.SELLER),
  FoodController.deleteSellerFood
);

//* ─── Admin Routes ────────────────────────────────────────────────────────────

router.get(
  "/admin",
  auth(UserRole.ADMIN),
  FoodController.getAllFoodsAdmin
);

router.patch(
  "/admin/:id/review",
  auth(UserRole.ADMIN),
  validateRequest(foodValidation.reviewFoodSchema),
  FoodController.reviewFood
);

router.patch(
  "/admin/:id/visibility",
  auth(UserRole.ADMIN),
  validateRequest(foodValidation.visibilityFoodSchema),
  FoodController.toggleFoodVisibility
);

router.delete(
  "/admin/:id",
  auth(UserRole.ADMIN),
  FoodController.deleteFoodAdmin
);


router.get(
  "/recipe/:category",
  FoodController.getRecipeByCategory
);

router.get(
  "/:id",
  FoodController.getFoodDetails
);

export const FoodRoutes = router;
