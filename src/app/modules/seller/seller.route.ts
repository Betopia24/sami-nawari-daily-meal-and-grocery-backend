import { UserRole } from "@prisma/client";
import express from "express";
import auth from "../../middlewares/auth";
import validateRequest from "../../middlewares/validateRequest";
import { fileUpload } from "../../utils/fileUpload";
import { SellerController } from "./seller.controller";
import { sellerValidation } from "./seller.validation";

const router = express.Router();


router.post(
  "/request",
  auth(UserRole.BUYER),
  fileUpload.upload.single("file"),
  SellerController.submitSellerRequest
);


router.get(
  "/profile/me",
  auth(UserRole.BUYER, UserRole.SELLER),
  SellerController.getMySellerProfile
);


router.patch(
  "/profile/me",
  auth(UserRole.SELLER),
  fileUpload.upload.single("file"),
  SellerController.updateSellerProfile
);


router.get(
  "/admin/requests",
  auth(UserRole.ADMIN),
  SellerController.getAllSellerRequests
);


router.get(
  "/admin/requests/:id",
  auth(UserRole.ADMIN),
  SellerController.getSellerRequestById
);


router.patch(
  "/admin/requests/:id/review",
  auth(UserRole.ADMIN),
  validateRequest(sellerValidation.approveRejectSellerSchema),
  SellerController.approveOrRejectSellerRequest
);

export const SellerRoutes = router;
