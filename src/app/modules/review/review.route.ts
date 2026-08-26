import { Router } from "express";
import { UserRole } from "@prisma/client";
import auth from "../../middlewares/auth";
import validateRequest from "../../middlewares/validateRequest";
import { reviewValidation } from "./review.validation";
import { ReviewController } from "./review.controller";

const router = Router();
router.get("/food/:foodId", ReviewController.getFoodReviews);

router.post(
  "/",
  auth(UserRole.BUYER),
  validateRequest(reviewValidation.createReviewSchema),
  ReviewController.submitReview
);

router.patch(
  "/:id",
  auth(UserRole.BUYER),
  validateRequest(reviewValidation.updateReviewSchema),
  ReviewController.updateReview
);

router.delete(
  "/:id",
  auth(UserRole.BUYER, UserRole.ADMIN),
  ReviewController.deleteReview
);



export const ReviewRoutes = router;
