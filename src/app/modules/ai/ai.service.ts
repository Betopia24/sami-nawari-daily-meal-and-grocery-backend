/* eslint-disable @typescript-eslint/no-explicit-any */
import httpStatus from "http-status";
import config from "../../config";
import ApiError from "../../errors/apiError";
import { objectIdToUuid } from "./ai.utils";

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
    "Authorization": `Bearer ${serviceToken}`,
    "X-User-ID": userUuid,
    "Content-Type": "application/json",
    ...extraHeaders,
  };

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);

  try {
    const response = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      const errorMsg = data?.detail || data?.message || `AI Service HTTP Error: ${response.status}`;
      throw new ApiError(response.status, errorMsg);
    }

    return data as T;
  } catch (err: any) {
    clearTimeout(timeoutId);
    if (err instanceof ApiError) throw err;
    if (err.name === "AbortError") {
      throw new ApiError(httpStatus.GATEWAY_TIMEOUT, "AI Service request timed out after 10 seconds");
    }
    throw new ApiError(httpStatus.BAD_GATEWAY, `Failed to communicate with AI Backend: ${err.message}`);
  }
};


const getFoodRecommendations = async (userId: string, payload: any) => {
  return request("/internal/v1/recommendations/foods", "POST", userId, {
    limit: payload.limit || 10,
    meal_type: payload.meal_type || payload.mealType || null,
    delivery_zone_id: payload.delivery_zone_id || null,
    exclude_food_ids: payload.exclude_food_ids || [],
  });
};


const getRecipeRecommendations = async (userId: string, payload: any) => {
  return request("/internal/v1/recommendations/recipes", "POST", userId, {
    limit: payload.limit || 10,
    meal_type: payload.meal_type || payload.mealType || null,
    max_cooking_time_minutes: payload.max_cooking_time_minutes || 60,
    exclude_recipe_ids: payload.exclude_recipe_ids || [],
  });
};


const generateMealPlan = async (userId: string, payload: any, idempotencyKey?: string) => {
  const extraHeaders: Record<string, string> | undefined = idempotencyKey ? { "Idempotency-Key": idempotencyKey } : undefined;
  return request("/internal/v1/meal-plans/generate", "POST", userId, {
    start_date: payload.start_date || payload.startDate || new Date().toISOString().split("T")[0],
    days: payload.days || 3,
    meals_per_day: payload.meals_per_day || payload.mealsPerDay || ["breakfast", "lunch", "dinner"],
    goal_override: payload.goal_override || null,
    excluded_recipe_ids: payload.excluded_recipe_ids || [],
  }, extraHeaders);
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

export const AIService = {
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

export const aiService = AIService;
