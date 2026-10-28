import { UserRole } from "@prisma/client";
import express from "express";
import auth from "../../middlewares/auth";
import validateRequest from "../../middlewares/validateRequest";
import { fileUpload } from "../../utils/fileUpload";
import { SellerController } from "./seller.controller";
import { sellerValidation } from "./seller.validation";
import { BookmarkController } from "../bookmark/bookmark.controller";

const router = express.Router();


router.post(
  "/request",
  auth(UserRole.BUYER),
  fileUpload.upload.any(),
  SellerController.submitSellerRequest
);

//* ─── Buyer Favorite Sellers Routes ──────────────────────────────────────────

router.get(
  "/favorites",
  auth(UserRole.BUYER, UserRole.SELLER),
  BookmarkController.getMyFavoriteSellers
);

router.post(
  "/favorites/toggle",
  auth(UserRole.BUYER, UserRole.SELLER),
  BookmarkController.toggleFavoriteSeller
);

router.post(
  "/:sellerId/favorite",
  auth(UserRole.BUYER, UserRole.SELLER),
  BookmarkController.toggleFavoriteSeller
);


router.get(
  "/profile/me",
  auth(UserRole.BUYER, UserRole.SELLER),
  SellerController.getMySellerProfile
);


router.patch(
  "/profile/me",
  auth(UserRole.SELLER),
  fileUpload.upload.any(),
  SellerController.updateSellerProfile
);

//* ─── Seller Stripe Connect Routes ───────────────────────────────────────────

router.post(
  "/stripe/connect",
  auth(UserRole.SELLER),
  SellerController.createStripeConnectAccount
);

router.get(
  "/stripe/status",
  auth(UserRole.SELLER),
  SellerController.getStripeAccountStatus
);

router.post(
  "/stripe/dashboard-link",
  auth(UserRole.SELLER),
  SellerController.createStripeDashboardLink
);

//* ─── Seller Earnings Routes ─────────────────────────────────────────────────

router.get(
  "/earnings",
  auth(UserRole.SELLER),
  SellerController.getSellerEarningsOverview
);

router.get(
  "/earnings/history",
  auth(UserRole.SELLER),
  SellerController.getSellerEarningsHistory
);


router.get(
  "/admin/requests",
  auth(UserRole.ADMIN),
  SellerController.getAllSellerRequests
);


router.get(
  "/admin/sellers",
  auth(UserRole.ADMIN),
  SellerController.getAllSellers
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


router.patch(
  "/admin/sellers/:sellerId/change-status",
  auth(UserRole.ADMIN),
  validateRequest(sellerValidation.changeSellerStatusSchema),
  SellerController.changeSellerStatus
);


router.patch(
  "/admin/sellers/change-status/:sellerId",
  auth(UserRole.ADMIN),
  validateRequest(sellerValidation.changeSellerStatusSchema),
  SellerController.changeSellerStatus
);


router.patch(
  "/admin/sellers/:id/status",
  auth(UserRole.ADMIN),
  validateRequest(sellerValidation.changeSellerStatusSchema),
  SellerController.changeSellerStatus
);


router.patch(
  "/admin/change-status/:id",
  auth(UserRole.ADMIN),
  validateRequest(sellerValidation.changeSellerStatusSchema),
  SellerController.changeSellerStatus
);

export const SellerRoutes = router;
