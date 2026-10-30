/* eslint-disable @typescript-eslint/no-explicit-any */
import { Request, Response } from "express";
import catchAsync from "../../utils/catchAsync";
import sendResponse from "../../utils/sendResponse";
import { ExploreService } from "./explore.service";
import { exploreValidation } from "./explore.validation";
import { FoodCategory } from "@prisma/client";

const getNearbySellers = catchAsync(async (req: Request, res: Response) => {
  const validatedQuery = await exploreValidation.getNearbySellersSchema.parseAsync(req.query);

  const result = await ExploreService.getNearbySellers(validatedQuery);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Nearby sellers retrieved successfully",
    data: result,
  });
});

const getSellerMenu = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params;
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
  const { page, limit } = await exploreValidation.getSellerReviewsSchema.parseAsync(req.query);

  const result = await ExploreService.getSellerReviews(id as string, page, limit);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Seller reviews retrieved successfully",
    data: result,
  });
});

const getFoodDetails = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params;
  const result = await ExploreService.getFoodDetails(id as string);

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
