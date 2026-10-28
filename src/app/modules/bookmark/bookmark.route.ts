import { Router } from "express";
import auth from "../../middlewares/auth";
import { UserRole } from "@prisma/client";
import { BookmarkController } from "./bookmark.controller";

const router = Router();

router.get("/", auth(UserRole.BUYER, UserRole.SELLER), BookmarkController.getMyBookmarks);
router.post("/toggle", auth(UserRole.BUYER, UserRole.SELLER), BookmarkController.toggleBookmark);

//* ─── Favorite Sellers Routes ────────────────────────────────────────────────
router.get("/sellers", auth(UserRole.BUYER, UserRole.SELLER), BookmarkController.getMyFavoriteSellers);
router.post("/sellers/toggle", auth(UserRole.BUYER, UserRole.SELLER), BookmarkController.toggleFavoriteSeller);
router.post("/sellers/:sellerId/toggle", auth(UserRole.BUYER, UserRole.SELLER), BookmarkController.toggleFavoriteSeller);

export const BookmarkRoutes = router;
