import { Router } from "express";
import { UserRoutes } from "../modules/user/user.route";
import { AuthRoutes } from "../modules/auth/auth.route";
import { SellerRoutes } from "../modules/seller/seller.route";
import { GroceryRoutes } from "../modules/grocery/grocery.route";
import { NotificationRoutes } from "../modules/notification/notification.route";
import { FoodRoutes } from "../modules/food/food.route";
import { CartRoutes } from "../modules/cart/cart.route";
import { OrderRoutes } from "../modules/order/order.route";
import { BookmarkRoutes } from "../modules/bookmark/bookmark.route";
import { ReviewRoutes } from "../modules/review/review.route";
import { ExploreRoutes } from "../modules/explore/explore.route";
import { PaymentRoutes } from "../modules/payment/payment.route";

import { AIPublicRoutes } from "../modules/ai/ai.public.route";

const router = Router();

router.use("/users", UserRoutes);
router.use("/auth", AuthRoutes);
router.use("/seller", SellerRoutes);
router.use("/grocery", GroceryRoutes);
router.use("/notifications", NotificationRoutes);
router.use("/foods", FoodRoutes);
router.use("/cart", CartRoutes);
router.use("/orders", OrderRoutes);
router.use("/payments", PaymentRoutes);
router.use("/bookmarks", BookmarkRoutes);
router.use("/reviews", ReviewRoutes);
router.use("/explore", ExploreRoutes);

// Public Gateway AI Endpoints for Flutter Client
router.use("/ai", AIPublicRoutes);

export default router;