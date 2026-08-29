/* eslint-disable @typescript-eslint/no-explicit-any */
import { Request, Response } from "express";
import httpStatus from "http-status";
import catchAsync from "../../utils/catchAsync";
import sendResponse from "../../utils/sendResponse";
import { aiService } from "./ai.service";


const getIdempotencyKey = (req: Request): string | undefined => {
  const key = req.headers["idempotency-key"] || req.headers["x-idempotency-key"];
  if (Array.isArray(key)) return key[0];
  return key;
};


const getFoodRecommendations = catchAsync(async (req: Request & { user?: any }, res: Response) => {
  const userId = req.user.userId;
  const result = await aiService.getFoodRecommendations(userId, req.body);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Food recommendations retrieved successfully",
    data: (result as any)?.data || result,
  });
});


const getRecipeRecommendations = catchAsync(async (req: Request & { user?: any }, res: Response) => {
  const userId = req.user.userId;
  const result = await aiService.getRecipeRecommendations(userId, req.body);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Recipe recommendations retrieved successfully",
    data: (result as any)?.data || result,
  });
});


const generateMealPlan = catchAsync(async (req: Request & { user?: any }, res: Response) => {
  const userId = req.user.userId;
  const idempotencyKey = getIdempotencyKey(req);

  const result = await aiService.generateMealPlan(userId, req.body, idempotencyKey);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "AI Meal Plan generated successfully",
    data: (result as any)?.data || result,
  });
});


const getReplacementOptions = catchAsync(async (req: Request & { user?: any }, res: Response) => {
  const userId = req.user.userId;
  const planId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const mealItemId = req.params.mealItemId || req.body.meal_item_id || req.body.mealItemId || req.body.recipe_id || "item1";

  const result = await aiService.getReplacementOptions(userId, planId, mealItemId, req.body);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Meal replacement options retrieved successfully",
    data: (result as any)?.data || result,
  });
});


const generateNutritionInsights = catchAsync(async (req: Request & { user?: any }, res: Response) => {
  const userId = req.user.userId;
  const planId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const idempotencyKey = getIdempotencyKey(req);

  const result = await aiService.generateNutritionInsights(userId, planId, idempotencyKey);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Nutrition insights generated successfully",
    data: (result as any)?.data || result,
  });
});


const getLatestNutritionInsights = catchAsync(async (req: Request & { user?: any }, res: Response) => {
  const userId = req.user.userId;
  const planId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

  const result = await aiService.getLatestNutritionInsights(userId, planId);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Latest nutrition insights retrieved successfully",
    data: (result as any)?.data || result,
  });
});


const getGroceryDraftFromMealPlan = catchAsync(async (req: Request & { user?: any }, res: Response) => {
  const userId = req.user.userId;
  const result = await aiService.getGroceryDraftFromMealPlan(userId, req.body);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Grocery list draft from meal plan created successfully",
    data: (result as any)?.data || result,
  });
});


const getGroceryDraftFromRecipe = catchAsync(async (req: Request & { user?: any }, res: Response) => {
  const userId = req.user.userId;
  const result = await aiService.getGroceryDraftFromRecipe(userId, req.body);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Grocery list draft from recipe created successfully",
    data: (result as any)?.data || result,
  });
});


const checkCompatibility = catchAsync(async (req: Request & { user?: any }, res: Response) => {
  const userId = req.user.userId;
  const result = await aiService.checkCompatibility(userId, req.body);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Compatibility check completed",
    data: (result as any)?.data || result,
  });
});


const checkCompatibilityBatch = catchAsync(async (req: Request & { user?: any }, res: Response) => {
  const userId = req.user.userId;
  const result = await aiService.checkCompatibilityBatch(userId, req.body);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Batch compatibility check completed",
    data: (result as any)?.data || result,
  });
});


const generateSellerRecipeDraft = catchAsync(async (req: Request & { user?: any }, res: Response) => {
  const userId = req.user.userId;
  const foodId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const idempotencyKey = getIdempotencyKey(req);

  const result = await aiService.generateSellerRecipeDraft(userId, foodId, req.body, idempotencyKey);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Seller recipe draft generated successfully",
    data: (result as any)?.data || result,
  });
});


const regenerateSellerRecipeDraft = catchAsync(async (req: Request & { user?: any }, res: Response) => {
  const userId = req.user.userId;
  const generationId = Array.isArray(req.params.generationId) ? req.params.generationId[0] : req.params.generationId;

  const result = await aiService.regenerateSellerRecipeDraft(userId, generationId, req.body);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Seller recipe draft regenerated successfully",
    data: (result as any)?.data || result,
  });
});


const trackRecommendationEvent = catchAsync(async (req: Request & { user?: any }, res: Response) => {
  const userId = req.user.userId;
  await aiService.trackRecommendationEvent(userId, req.body);
  res.status(httpStatus.NO_CONTENT).send();
});

export const AIPublicController = {
  getFoodRecommendations,
  getRecipeRecommendations,
  generateMealPlan,
  getReplacementOptions,
  generateNutritionInsights,
  getLatestNutritionInsights,
  getGroceryDraftFromMealPlan,
  getGroceryDraftFromRecipe,
  checkCompatibility,
  checkCompatibilityBatch,
  generateSellerRecipeDraft,
  regenerateSellerRecipeDraft,
  trackRecommendationEvent,
};
