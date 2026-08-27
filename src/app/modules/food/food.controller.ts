/* eslint-disable @typescript-eslint/no-explicit-any */
import { Request, Response } from "express";
import catchAsync from "../../utils/catchAsync";
import sendResponse from "../../utils/sendResponse";
import { fileUpload } from "../../utils/fileUpload";
import { FoodService } from "./food.service";
import { foodValidation } from "./food.validation";
import { FoodStatus } from "@prisma/client";

const parseFoodPayload = async (req: Request) => {
  let payload = req.body;

  if (req.body.data) {
    payload = JSON.parse(req.body.data);
  }

  console.log("DEBUG parseFoodPayload - req.files:", req.files ? (req.files as any).length : "none");
  console.log("DEBUG parseFoodPayload - req.file:", req.file ? "present" : "none");
  console.log("DEBUG parseFoodPayload - req.body.data:", req.body.data);

  if (typeof payload.ingredients === "string") {
    payload.ingredients = JSON.parse(payload.ingredients);
  }
  if (payload.price !== undefined) {
    payload.price = Number(payload.price);
  }
  if (payload.deliveryFee !== undefined) {
    payload.deliveryFee = Number(payload.deliveryFee);
  }
  if (payload.pickupAvailable !== undefined) {
    payload.pickupAvailable = payload.pickupAvailable === "true" || payload.pickupAvailable === true;
  }
  if (payload.deliveryAvailable !== undefined) {
    payload.deliveryAvailable = payload.deliveryAvailable === "true" || payload.deliveryAvailable === true;
  }

  const imageUrls: string[] = [];
  if (req.files && Array.isArray(req.files)) {
    for (const file of req.files) {
      const uploadResult = await fileUpload.uploadToCloudinary(file);
      if (uploadResult && uploadResult.secure_url) {
        imageUrls.push(uploadResult.secure_url);
      }
    }
  } else if (req.file) {
    const uploadResult = await fileUpload.uploadToCloudinary(req.file);
    if (uploadResult && uploadResult.secure_url) {
      imageUrls.push(uploadResult.secure_url);
    }
  }

  if (imageUrls.length > 0) {
    payload.images = payload.images ? [...payload.images, ...imageUrls] : imageUrls;
  }

  return payload;
};

const createFood = catchAsync(async (req: Request & { user?: any }, res: Response) => {
  const decodedUser = req.user as any;
  const payload = await parseFoodPayload(req);

  const validatedData = await foodValidation.createFoodSchema.parseAsync(payload);

  const result = await FoodService.createFood(decodedUser.userId, validatedData);

  sendResponse(res, {
    statusCode: 201,
    success: true,
    message: "Food item submitted for admin review successfully.",
    data: result,
  });
});

const getSellerFoods = catchAsync(async (req: Request & { user?: any }, res: Response) => {
  const decodedUser = req.user as any;
  const result = await FoodService.getSellerFoods(decodedUser.userId, req.query);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Seller food listings retrieved successfully",
    data: result,
  });
});

const getSellerFoodDetails = catchAsync(async (req: Request & { user?: any }, res: Response) => {
  const decodedUser = req.user as any;
  const result = await FoodService.getSellerFoodDetails(decodedUser.userId, req.params.id as string);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Seller food details retrieved successfully",
    data: result,
  });
});

const updateSellerFood = catchAsync(async (req: Request & { user?: any }, res: Response) => {
  const decodedUser = req.user as any;
  const payload = await parseFoodPayload(req);

  const validatedData = await foodValidation.updateFoodSchema.parseAsync(payload);

  const result = await FoodService.updateSellerFood(decodedUser.userId, req.params.id as string, validatedData);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Food listing updated and resubmitted for admin review.",
    data: result,
  });
});

const deleteSellerFood = catchAsync(async (req: Request & { user?: any }, res: Response) => {
  const decodedUser = req.user as any;
  const result = await FoodService.deleteSellerFood(decodedUser.userId, req.params.id as string);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Food listing deleted successfully",
    data: result,
  });
});

//* ─── Admin Controllers ────────────────────────────────────────────────────────
const getAllFoodsAdmin = catchAsync(async (req: Request, res: Response) => {
  const result = await FoodService.getAllFoodsAdmin(req.query);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Admin food listings retrieved successfully",
    data: result,
  });
});

const reviewFood = catchAsync(async (req: Request, res: Response) => {
  const validatedBody = await foodValidation.reviewFoodSchema.parseAsync(req.body);
  const result = await FoodService.reviewFood(req.params.id as string, validatedBody.status);

  const action = validatedBody.status === FoodStatus.PUBLISHED ? "approved & published" : "rejected";

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: `Food item has been ${action} successfully.`,
    data: result,
  });
});

const toggleFoodVisibility = catchAsync(async (req: Request, res: Response) => {
  const validatedBody = await foodValidation.visibilityFoodSchema.parseAsync(req.body);
  const result = await FoodService.toggleFoodVisibility(req.params.id as string, validatedBody.status);

  const action = validatedBody.status === FoodStatus.HIDDEN ? "hidden" : "unhidden & published";

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: `Food item has been ${action} successfully.`,
    data: result,
  });
});

const deleteFoodAdmin = catchAsync(async (req: Request, res: Response) => {
  const result = await FoodService.deleteFoodAdmin(req.params.id as string);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Food listing deleted by admin successfully",
    data: result,
  });
});

//* ─── Customer Controllers ─────────────────────────────────────────────────────

const getPublishedFoods = catchAsync(async (req: Request, res: Response) => {
  const result = await FoodService.getPublishedFoods(req.query);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Foods retrieved successfully",
    data: result,
  });
});

const getFoodDetails = catchAsync(async (req: Request, res: Response) => {
  const result = await FoodService.getFoodDetails(req.params.id as string);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Food details retrieved successfully",
    data: result,
  });
});

const getRecipeByCategory = catchAsync(async (req: Request, res: Response) => {
  const result = await FoodService.getRecipeByCategory(req.params.category as string, req.query);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Recipes retrieved successfully",
    data: result,
  });
});

export const FoodController = {
  createFood,
  getSellerFoods,
  getSellerFoodDetails,
  updateSellerFood,
  deleteSellerFood,
  getAllFoodsAdmin,
  reviewFood,
  toggleFoodVisibility,
  deleteFoodAdmin,
  getPublishedFoods,
  getFoodDetails,
  getRecipeByCategory,
};
