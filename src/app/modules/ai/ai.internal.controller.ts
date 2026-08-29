/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { FoodStatus } from "@prisma/client";
import { Request, Response } from "express";
import httpStatus from "http-status";
import ApiError from "../../errors/apiError";
import { prisma } from "../../prisma/prisma";
import catchAsync from "../../utils/catchAsync";
import {
  mapFoodToFoodItem,
  mapRecipeToRecipe,
  mapSellerFoodToSellerFoodDraft,
  mapUserToUserAIProfile,
  objectIdToUuid,
} from "./ai.utils";

const parseSingleString = (val: any): string => {
  if (Array.isArray(val)) return String(val[0]);
  if (typeof val === "string") return val;
  return String(val || "");
};

const findUserByIdOrUuid = async (userIdOrUuid: string) => {
  if (!userIdOrUuid) return null;
  if (userIdOrUuid.length === 24) {
    const directUser = await prisma.user.findUnique({ where: { id: userIdOrUuid } });
    if (directUser) return directUser;
  }
  const userIds = await prisma.user.findMany({ select: { id: true } });
  const matched = userIds.find((u) => u.id === userIdOrUuid || objectIdToUuid(u.id) === userIdOrUuid);
  if (!matched) return null;
  return prisma.user.findUnique({ where: { id: matched.id } });
};

const findFoodByIdOrUuid = async (foodIdOrUuid: string) => {
  if (!foodIdOrUuid) return null;
  if (foodIdOrUuid.length === 24) {
    const food = await prisma.food.findUnique({ where: { id: foodIdOrUuid } });
    if (food) return food;
  }
  const foodIds = await prisma.food.findMany({ select: { id: true } });
  const matched = foodIds.find((f) => f.id === foodIdOrUuid || objectIdToUuid(f.id) === foodIdOrUuid);
  if (!matched) return null;
  return prisma.food.findUnique({ where: { id: matched.id } });
};


const getUserProfile = catchAsync(async (req: Request, res: Response) => {
  const userIdParam = parseSingleString(req.params.user_id);
  const user = await findUserByIdOrUuid(userIdParam);

  if (!user) {
    throw new ApiError(httpStatus.NOT_FOUND, `User profile not found for ID: ${userIdParam}`);
  }

  const profile = mapUserToUserAIProfile(user);
  res.status(httpStatus.OK).json({ data: profile });
});


const invalidateProfileCache = catchAsync(async (req: Request, res: Response) => {
  const userIdParam = parseSingleString(req.params.user_id);
  const user = await findUserByIdOrUuid(userIdParam);

  if (!user) {
    throw new ApiError(httpStatus.NOT_FOUND, `User profile not found for ID: ${userIdParam}`);
  }

  const profileVersion = req.body?.profile_version || (user as any).profileVersion || 1;

  res.status(httpStatus.OK).json({
    data: {
      invalidated: true,
      profile_version: profileVersion,
    },
  });
});


const getFoodCandidates = catchAsync(async (req: Request, res: Response) => {
  const limit = parseInt(parseSingleString(req.query.limit)) || 50;

  const foods = await prisma.food.findMany({
    where: { status: FoodStatus.PUBLISHED },
    take: limit,
  });

  const candidates = foods.map(mapFoodToFoodItem);
  res.status(httpStatus.OK).json({ data: candidates });
});


const getRecipeCandidates = catchAsync(async (req: Request, res: Response) => {
  const limit = parseInt(parseSingleString(req.query.limit)) || 50;

  const foods = await prisma.food.findMany({
    where: { status: FoodStatus.PUBLISHED },
    take: limit,
  });

  const candidates = foods.map(mapRecipeToRecipe);
  res.status(httpStatus.OK).json({ data: candidates });
});


const getFoodById = catchAsync(async (req: Request, res: Response) => {
  const foodId = parseSingleString(req.params.food_id);
  const food = await findFoodByIdOrUuid(foodId);

  if (!food) {
    throw new ApiError(httpStatus.NOT_FOUND, `Food item not found for ID: ${foodId}`);
  }

  const foodItem = mapFoodToFoodItem(food);
  res.status(httpStatus.OK).json({ data: foodItem });
});


const getRecipeById = catchAsync(async (req: Request, res: Response) => {
  const recipeId = parseSingleString(req.params.recipe_id);
  const food = await findFoodByIdOrUuid(recipeId);

  if (!food) {
    throw new ApiError(httpStatus.NOT_FOUND, `Recipe not found for ID: ${recipeId}`);
  }

  res.status(httpStatus.OK).json({ data: mapRecipeToRecipe(food) });
});


const getMealPlanById = catchAsync(async (req: Request, res: Response) => {
  const planId = parseSingleString(req.params.plan_id);
  const userIdParam = req.query.user_id ? parseSingleString(req.query.user_id) : undefined;

  if (!userIdParam) {
    throw new ApiError(httpStatus.BAD_REQUEST, "user_id query parameter is required");
  }

  const user = await findUserByIdOrUuid(userIdParam);

  if (!user) {
    throw new ApiError(httpStatus.NOT_FOUND, `User not found for ID: ${userIdParam}`);
  }

  // TODO: Implement meal plan lookup once MealPlan model is defined in Prisma schema
  throw new ApiError(httpStatus.NOT_FOUND, `Meal plan not found for ID: ${planId}`);
});


const getSellerFoodDraft = catchAsync(async (req: Request, res: Response) => {
  const foodId = parseSingleString(req.params.food_id);
  const sellerUserParam = req.query.seller_user_id ? parseSingleString(req.query.seller_user_id) : undefined;

  if (!sellerUserParam) {
    throw new ApiError(httpStatus.BAD_REQUEST, "seller_user_id query parameter is required");
  }

  const sellerUser = await findUserByIdOrUuid(sellerUserParam);

  if (!sellerUser) {
    throw new ApiError(httpStatus.NOT_FOUND, `Seller user not found for ID: ${sellerUserParam}`);
  }

  const food = await findFoodByIdOrUuid(foodId);

  if (!food) {
    throw new ApiError(httpStatus.NOT_FOUND, `Seller food draft not found for ID: ${foodId}`);
  }

  const draft = mapSellerFoodToSellerFoodDraft(food);

  if (draft.seller_user_id !== objectIdToUuid(sellerUser.id)) {
    throw new ApiError(httpStatus.FORBIDDEN, "Access forbidden: food draft does not belong to seller");
  }

  res.status(httpStatus.OK).json({ data: draft });
});

export const AIInternalController = {
  getUserProfile,
  invalidateProfileCache,
  getFoodCandidates,
  getRecipeCandidates,
  getFoodById,
  getRecipeById,
  getMealPlanById,
  getSellerFoodDraft,
};
