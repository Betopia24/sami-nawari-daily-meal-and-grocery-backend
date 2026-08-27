/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextFunction, Request, Response, Router } from "express";
import { ExploreController } from "./explore.controller";
import config from "../../config";
import { jwtHelper } from "../../utils/JwtHelper";
import { rateLimit } from "express-rate-limit";

// Middleware to optionally parse jwt token without throwing errors, enabling guest/public access
const optionalAuth = async (req: Request & { user?: any }, res: Response, next: NextFunction) => {
  let token = req.cookies?.accessToken || req.headers.authorization || req.headers.token;
  if (token) {
    if (typeof token === "string" && token.startsWith("Bearer ")) {
      token = token.split(" ")[1];
    }
    const secret = (config.jwt.accessToken || process.env.JWT_ACCESS_SECRET) as string;
    try {
      const decoded = jwtHelper.verifyToken(token, secret);
      if (decoded) {
        req.user = decoded;
      }
    } catch (err) {
      // Ignore invalid tokens to let public users view contents
    }
  }
  next();
};

// Fix #12 (Security): Rate limit the geospatial nearby-sellers endpoint.
// This is the heaviest query ($geoNear aggregation) and is fully public — making it a
// prime target for geo-scraping and DoS attacks without a rate limit.
// Allows 30 requests per minute per IP for anonymous callers.
const nearbySellersRateLimit = rateLimit({
  windowMs: 60 * 1000, // 1 minute window
  max: 30, // max 30 requests per IP per window
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many location search requests. Please wait a moment and try again.",
  },
  skip: (req: Request & { user?: any }) => {
    // Authenticated users are trusted — skip rate limiting for them
    return !!req.user;
  },
});

// Fix #12 (Security): General rate limit for all other public explore routes (menus, reviews, etc.)
// Allows 60 requests per minute per IP.
const exploreGeneralRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many requests. Please slow down and try again shortly.",
  },
  skip: (req: Request & { user?: any }) => !!req.user,
});

const router = Router();

// Apply optionalAuth globally to all explore routes so authenticated users bypass rate limits
router.use(optionalAuth);

router.get("/sellers", nearbySellersRateLimit, ExploreController.getNearbySellers);
router.get("/sellers/:id/menu", exploreGeneralRateLimit, ExploreController.getSellerMenu);
router.get("/sellers/:id/about", exploreGeneralRateLimit, ExploreController.getSellerAbout);
router.get("/sellers/:id/reviews", exploreGeneralRateLimit, ExploreController.getSellerReviews);
router.get("/foods/:id", ExploreController.getFoodDetails);

export const ExploreRoutes = router;
