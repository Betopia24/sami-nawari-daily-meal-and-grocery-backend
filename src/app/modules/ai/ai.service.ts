/* eslint-disable @typescript-eslint/no-explicit-any */
import { FoodStatus } from "@prisma/client";
import httpStatus from "http-status";
import { v4 as uuidv4 } from "uuid";
import config from "../../config";
import ApiError from "../../errors/apiError";
import { prisma } from "../../prisma/prisma";
import { mapMealPlanToStoredMealPlan, objectIdToUuid } from "./ai.utils";

const getBaseUrl = (): string => config.aiService.baseUrl.replace(/\/$/, "");
const getServiceToken = (): string => config.aiService.serviceToken;


const request = async <T>(
  endpoint: string,
  method: "GET" | "POST" | "PUT" | "DELETE",
  userMongoId: string,
  body?: any,
  extraHeaders?: Record<string, string>
): Promise<T> => {
  const userUuid = objectIdToUuid(userMongoId);
  const baseUrl = getBaseUrl();
  const serviceToken = getServiceToken();
  const url = `${baseUrl}${endpoint.startsWith("/") ? endpoint : `/${endpoint}`}`;

  const headers: Record<string, string> = {
    "X-User-ID": userUuid,
    "X-Request-ID": extraHeaders?.["X-Request-ID"] || uuidv4(),
    "Content-Type": "application/json",
    ...extraHeaders,
  };

  if (serviceToken) {
    headers["Authorization"] = `Bearer ${serviceToken}`;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);

  try {
    const response = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (response.status === 204) {
      return {} as T;
    }

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      const errorMsg =
        data?.error?.message ||
        data?.detail ||
        data?.message ||
        `AI Service HTTP Error: ${response.status}`;
      throw new ApiError(response.status, errorMsg);
    }

    return data as T;
  } catch (err: any) {
    clearTimeout(timeoutId);
    if (err instanceof ApiError) throw err;
    if (err.name === "AbortError") {
      throw new ApiError(httpStatus.GATEWAY_TIMEOUT, "AI Service request timed out");
    }
    throw new ApiError(httpStatus.BAD_GATEWAY, `Failed to communicate with AI Backend: ${err.message}`);
  }
};


export const findMealPlanByIdOrPlanId = async (planIdOrMongoId: string) => {
  if (!planIdOrMongoId) return null;

  const byPlanId = await prisma.mealPlan.findUnique({
    where: { planId: planIdOrMongoId },
  });
  if (byPlanId) return byPlanId;

  if (/^[0-9a-fA-F]{24}$/.test(planIdOrMongoId)) {
    const byId = await prisma.mealPlan.findUnique({
      where: { id: planIdOrMongoId },
    });
    if (byId) return byId;
  }

  const allPlans = await prisma.mealPlan.findMany({
    select: { id: true, planId: true, rawResponse: true },
  });
  const matched = allPlans.find((plan) => {
    const rawResponse =
      plan.rawResponse && typeof plan.rawResponse === "object"
        ? (plan.rawResponse as any)
        : {};

    return (
      plan.id === planIdOrMongoId ||
      plan.planId === planIdOrMongoId ||
      objectIdToUuid(plan.id) === planIdOrMongoId ||
      rawResponse.generation_id === planIdOrMongoId
    );
  });
  if (!matched) return null;

  return prisma.mealPlan.findUnique({ where: { id: matched.id } });
};

const assertMealPlanOwner = (mealPlanUserId: string, userId: string) => {
  if (
    mealPlanUserId !== userId &&
    objectIdToUuid(mealPlanUserId) !== objectIdToUuid(userId)
  ) {
    throw new ApiError(
      httpStatus.FORBIDDEN,
      "Access forbidden: meal plan does not belong to user",
    );
  }
};

const mapStoredMealPlanResponse = (plan: any) => ({
  id: plan.id,
  ...mapMealPlanToStoredMealPlan(plan),
  start_date: plan.startDate,
  created_at: plan.createdAt,
  updated_at: plan.updatedAt,
});


const enrichFoodRecommendations = async (response: any) => {
  const recommendation = response?.data || response;
  const items = Array.isArray(recommendation?.items) ? recommendation.items : [];

  if (items.length === 0) {
    return response;
  }

  // AI receives UUID v5 IDs generated from MongoDB ObjectIds. Resolve those
  // IDs back to the actual food records so clients can render the cards
  // without making another lookup for every recommendation item.
  const publishedFoodIds = await prisma.food.findMany({
    where: { status: FoodStatus.PUBLISHED },
    select: { id: true },
  });
  const foodIdByUuid = new Map(
    publishedFoodIds.map((food) => [objectIdToUuid(food.id), food.id]),
  );
  const recommendedFoodIds = items
    .map((item: any) => {
      if (typeof item.item_id !== "string") return null;
      if (/^[0-9a-fA-F]{24}$/.test(item.item_id)) return item.item_id;
      return foodIdByUuid.get(item.item_id) || null;
    })
    .filter((id: string | null): id is string => Boolean(id));

  const foods =
    recommendedFoodIds.length > 0
      ? await prisma.food.findMany({
          where: {
            id: { in: recommendedFoodIds },
            status: FoodStatus.PUBLISHED,
          },
          include: {
            seller: {
              select: {
                id: true,
                name: true,
                profilePicture: true,
                sellerProfile: {
                  select: {
                    businessName: true,
                    address: true,
                  },
                },
              },
            },
          },
        })
      : [];

  const foodsByUuid = new Map(
    foods.map((food) => [objectIdToUuid(food.id), food]),
  );
  const foodsById = new Map(foods.map((food) => [food.id, food]));

  const enrichedItems = items.map((item: any) => {
    const food =
      foodsById.get(item.item_id) || foodsByUuid.get(item.item_id) || null;

    return {
      ...item,
      food_id: food?.id || null,
      food,
    };
  });

  if (response?.data) {
    response.data.items = enrichedItems;
  } else if (response && typeof response === "object") {
    response.items = enrichedItems;
  }

  return response;
};


const getFoodRecommendations = async (userId: string, payload: any) => {
  const response = await request("/internal/v1/recommendations/foods", "POST", userId, {
    limit: payload.limit || 10,
    meal_type: payload.meal_type || payload.mealType || null,
    delivery_zone_id: payload.delivery_zone_id || null,
    exclude_food_ids: payload.exclude_food_ids || [],
  });

  return enrichFoodRecommendations(response);
};


const getRecipeRecommendations = async (userId: string, payload: any) => {
  const response = await request("/internal/v1/recommendations/recipes", "POST", userId, {
    limit: payload.limit || 10,
    meal_type: payload.meal_type || payload.mealType || null,
    max_cooking_time_minutes: payload.max_cooking_time_minutes || 60,
    exclude_recipe_ids: payload.exclude_recipe_ids || [],
  });

  return enrichFoodRecommendations(response);
};


const generateMealPlan = async (userId: string, payload: any, idempotencyKey?: string) => {
  const extraHeaders: Record<string, string> | undefined = idempotencyKey ? { "Idempotency-Key": idempotencyKey } : undefined;
  const startDate = payload.start_date || payload.startDate || new Date().toISOString().split("T")[0];

  const response: any = await request("/internal/v1/meal-plans/generate", "POST", userId, {
    start_date: startDate,
    days: payload.days || 3,
    meals_per_day: payload.meals_per_day || payload.mealsPerDay || ["breakfast", "lunch", "dinner"],
    goal_override: payload.goal_override || null,
    excluded_recipe_ids: payload.excluded_recipe_ids || [],
  }, extraHeaders);

  const planData = response?.data || response;
  const plan = planData?.plan || {};
  const planId =
    planData?.plan_id ||
    plan?.plan_id ||
    planData?.generation_id ||
    planData?.id ||
    uuidv4();
  const days = Array.isArray(plan?.days)
    ? plan.days
    : Array.isArray(planData?.days)
      ? planData.days
      : [];
  const version =
    typeof plan?.version === "number"
      ? plan.version
      : typeof planData?.version === "number"
        ? planData.version
        : 1;

  const existingPlan = await prisma.mealPlan.findUnique({
    where: { planId },
    select: { userId: true },
  });
  if (existingPlan) {
    assertMealPlanOwner(existingPlan.userId, userId);
  }

  const savedPlan = await prisma.mealPlan.upsert({
    where: { planId },
    update: {
      version,
      startDate,
      days,
      rawResponse: planData,
    },
    create: {
      planId,
      userId,
      version,
      startDate,
      days,
      rawResponse: planData,
    },
  });

  if (response?.data) {
    response.data.plan_id = savedPlan.planId;
    response.data.id = savedPlan.id;
  } else if (typeof response === "object" && response !== null) {
    response.plan_id = savedPlan.planId;
    response.id = savedPlan.id;
  }

  return response;
};


const getMyMealPlans = async (userId: string) => {
  const plans = await prisma.mealPlan.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });

  return plans.map(mapStoredMealPlanResponse);
};


const getMealPlan = async (userId: string, planId: string) => {
  const plan = await findMealPlanByIdOrPlanId(planId);

  if (!plan) {
    throw new ApiError(httpStatus.NOT_FOUND, `Meal plan not found for ID: ${planId}`);
  }

  assertMealPlanOwner(plan.userId, userId);

  return mapStoredMealPlanResponse(plan);
};


const getReplacementOptions = async (userId: string, planId: string, mealItemId: string, payload?: any) => {
  const endpoint = `/internal/v1/meal-plans/${planId}/items/${mealItemId}/replacement-options`;
  return request(endpoint, "POST", userId, {
    preference: payload?.preference || null,
    limit: typeof payload?.limit === "number" ? payload.limit : 3,
  });
};


const generateNutritionInsights = async (userId: string, planId: string, idempotencyKey?: string) => {
  const endpoint = `/internal/v1/meal-plans/${planId}/insights`;
  const extraHeaders: Record<string, string> | undefined = idempotencyKey ? { "Idempotency-Key": idempotencyKey } : undefined;
  return request(endpoint, "POST", userId, {}, extraHeaders);
};


const getLatestNutritionInsights = async (userId: string, planId: string) => {
  const endpoint = `/internal/v1/meal-plans/${planId}/insights/latest`;
  return request(endpoint, "GET", userId);
};


const getGroceryDraftFromMealPlan = async (userId: string, payload: any) => {
  return request("/internal/v1/grocery-drafts/from-meal-plan", "POST", userId, {
    meal_plan_id: payload.meal_plan_id || payload.mealPlanId,
  });
};


const getGroceryDraftFromRecipe = async (userId: string, payload: any) => {
  return request("/internal/v1/grocery-drafts/from-recipe", "POST", userId, {
    recipe_id: payload.recipe_id || payload.recipeId,
    servings: payload.servings || 4,
  });
};


const checkCompatibility = async (userId: string, payload: any) => {
  return request("/internal/v1/compatibility/check", "POST", userId, {
    resource_type: payload.resource_type || payload.resourceType || "recipe",
    resource_id: payload.resource_id || payload.resourceId,
  });
};


const checkCompatibilityBatch = async (userId: string, payload: any) => {
  return request("/internal/v1/compatibility/check-batch", "POST", userId, {
    items: payload.items || [],
  });
};


const generateSellerRecipeDraft = async (userId: string, foodId: string, payload?: any, idempotencyKey?: string) => {
  const endpoint = `/internal/v1/seller-foods/${foodId}/recipe-drafts/generate`;
  const extraHeaders: Record<string, string> | undefined = idempotencyKey ? { "Idempotency-Key": idempotencyKey } : undefined;
  return request(endpoint, "POST", userId, {
    language: payload?.language || "en",
  }, extraHeaders);
};


const regenerateSellerRecipeDraft = async (userId: string, generationId: string, payload?: any) => {
  const endpoint = `/internal/v1/seller-foods/${generationId}/recipe-drafts/regenerate`;
  return request(endpoint, "POST", userId, {
    previous_generation_id: payload?.previous_generation_id || payload?.previousGenerationId || generationId,
    instructions: payload?.instructions || "Make the preparation instructions simpler and shorter.",
  });
};


const trackRecommendationEvent = async (userId: string, payload: any) => {
  return request("/internal/v1/recommendation-events", "POST", userId, {
    recommendation_id: payload.recommendation_id || payload.recommendationId,
    item_type: payload.item_type || payload.itemType || "food",
    item_id: payload.item_id || payload.itemId,
    event: payload.event || "clicked",
  });
};

const invalidateUserProfileCache = async (userId: string, profileVersion: number) => {
  const userUuid = objectIdToUuid(userId);
  try {
    return await request(`/internal/v1/users/${userUuid}/profile-cache/invalidate`, "POST", userId, {
      profile_version: profileVersion,
    });
  } catch {
    // Non-blocking: if AI server is offline or unreachable during user profile update, do not fail the user update
    return null;
  }
};

export const AIService = {
  getFoodRecommendations,
  getRecipeRecommendations,
  generateMealPlan,
  getMyMealPlans,
  getMealPlan,
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
  invalidateUserProfileCache,
};

export const aiService = AIService;
