import { Router } from "express";
import auth from "../../middlewares/auth";
import { UserRole } from "@prisma/client";
import { BookmarkController } from "./bookmark.controller";

const router = Router();

router.get("/", auth(UserRole.BUYER), BookmarkController.getMyBookmarks);
router.post("/toggle", auth(UserRole.BUYER), BookmarkController.toggleBookmark);

export const BookmarkRoutes = router;
