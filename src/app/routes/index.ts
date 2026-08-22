import { Router } from "express";
import { UserRoutes } from "../modules/user/user.route";
import { AuthRoutes } from "../modules/auth/auth.route";
import { SellerRoutes } from "../modules/seller/seller.route";
import { GroceryRoutes } from "../modules/grocery/grocery.route";
import { NotificationRoutes } from "../modules/notification/notification.route";

const router = Router();

router.use("/users", UserRoutes);
router.use("/auth", AuthRoutes);
router.use("/seller", SellerRoutes);
router.use("/grocery", GroceryRoutes);
router.use("/notifications", NotificationRoutes);

export default router;