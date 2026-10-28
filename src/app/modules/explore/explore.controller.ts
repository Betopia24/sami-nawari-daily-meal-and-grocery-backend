/* eslint-disable @typescript-eslint/no-explicit-any */
import { Request, Response } from "express";
import catchAsync from "../../utils/catchAsync";
import sendResponse from "../../utils/sendResponse";
import { ExploreService } from "./explore.service";
import { exploreValidation } from "./explore.validation";
import { FoodCategory } from "@prisma/client";

// Fix #4/#5: All query params now go through Zod validation schemas.
// This eliminates the FoodCategory type-cast bug and the NaN risk from raw parseInt calls.

const getNearbySellers = catchAsync(async (req: Request, res: Response) => {
  // Fix #2/#3/#5: Validates radius cap (max 10km), parses page/limit safely via Zod
  const validatedQuery = await exploreValidation.getNearbySellersSchema.parseAsync(req.query);
  const { latitude, longitude, radius, page, limit } = validatedQuery;

  const result = await ExploreService.getNearbySellers(latitude, longitude, radius, page, limit);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Nearby sellers retrieved successfully",
    data: result,
  });
});

const getSellerMenu = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params;
  // Fix #4/#5: Zod validates FoodCategory enum at runtime and guards page/limit against NaN
  const { category, page, limit } = await exploreValidation.getSellerMenuSchema.parseAsync(req.query);

  const result = await ExploreService.getSellerMenu(
    id as string,
    category as FoodCategory | undefined,
    page,
    limit
  );

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Seller menu retrieved successfully",
    data: result,
  });
});

const getSellerAbout = catchAsync(async (req: Request & { user?: any }, res: Response) => {
  const { id } = req.params;
  const userId = req.user?.userId;
  // Note: `id` here can be either User ID (User.id) or SellerProfile.id.
  const result = await ExploreService.getSellerAbout(id as string, userId);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Seller profile details retrieved successfully",
    data: result,
  });
});

const getSellerReviews = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params;
  // Fix #5: Zod guards page/limit against NaN and caps at 50
  const { page, limit } = await exploreValidation.getSellerReviewsSchema.parseAsync(req.query);

  const result = await ExploreService.getSellerReviews(id as string, page, limit);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Seller reviews retrieved successfully",
    data: result,
  });
});

const getFoodDetails = catchAsync(async (req: Request & { user?: any }, res: Response) => {
  const { id } = req.params;
  const userId = req.user?.userId;

  const result = await ExploreService.getFoodDetails(id as string, userId);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Food details retrieved successfully",
    data: result,
  });
});

export const ExploreController = {
  getNearbySellers,
  getSellerMenu,
  getSellerAbout,
  getSellerReviews,
  getFoodDetails,
};
