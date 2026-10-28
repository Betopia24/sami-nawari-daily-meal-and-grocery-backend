/* eslint-disable @typescript-eslint/no-explicit-any */
import { FoodStatus } from "@prisma/client";
import { v5 as uuidv5, validate as uuidValidate } from "uuid";
import {
  FoodItem,
  IngredientAmount,
  MealPlanDay,
  Recipe,
  SellerFoodDraft,
  StoredMealPlan,
  UserAIProfile,
} from "./ai.interface";

const NAMESPACE_UUID = "6ba7b810-9dad-11d1-80b4-00c04fd430c8";

export const objectIdToUuid = (id: string): string => {
  if (!id) return "00000000-0000-0000-0000-000000000000";
  if (uuidValidate(id)) {
    return id;
  }
  return uuidv5(id, NAMESPACE_UUID);
};

export const normalizeUnit = (unit: string): string => {
  if (!unit) return "g";
  const lower = unit.toLowerCase().trim();
  if (["g", "gram", "grams"].includes(lower)) return "g";
  if (["kg", "kilogram", "kilograms"].includes(lower)) return "kg";
  if (["ml", "milliliter", "milliliters"].includes(lower)) return "ml";
  if (["l", "liter", "litre", "liters", "litres"].includes(lower)) return "l";
  if (["pc", "pcs", "piece", "pieces"].includes(lower)) return "pc";
  return lower;
};


export const mapUserToUserAIProfile = (user: any): UserAIProfile => {
  const userIdUuid = objectIdToUuid(user.id || user._id?.toString());
  const rawFavorites = Array.isArray(user.favoriteSellers)
    ? user.favoriteSellers.map((fav: any) => fav.seller?.userId || fav.sellerId || fav)
    : user.favoriteSellerIds || [];

  return {
    user_id: userIdUuid,
    profile_version: user.profileVersion || 1,
    dietary_preferences: (user.dietaryPreferences || []).map((p: string) => p.toLowerCase()),
    allergies: (user.allergies || []).map((a: string) => a.toLowerCase()),
    preferred_cuisines: (user.preferredCuisines?.length ? user.preferredCuisines : ["bangladeshi"]).map((c: string) => c.toLowerCase()),
    nutrition_goal: user.nutritionGoal ? user.nutritionGoal.toLowerCase() : "healthy",
    household_size: typeof user.householdSize === "number" && user.householdSize > 0 ? user.householdSize : 1,
    cooking_frequency: user.cookingFrequency || null,
    language: user.language || "en",
    favorite_seller_ids: rawFavorites.filter(Boolean).map((s: any) => objectIdToUuid(s.toString())),
    behavior_affinity: user.behaviorAffinity || {},
  };
};


export const mapFoodToFoodItem = (food: any): FoodItem => {
  const rawIngredients = Array.isArray(food.ingredients) ? food.ingredients : [];
  const ingredients: IngredientAmount[] = rawIngredients.map((ing: any) => ({
    ingredient_id: ing.ingredient_id || ing.id || ing.name?.toLowerCase().replace(/\s+/g, "_") || "unknown",
    name: ing.name || "Unknown Ingredient",
    quantity: typeof ing.quantity === "number" ? ing.quantity : 100,
    unit: normalizeUnit(ing.unit || "g"),
    category: ing.category || "other",
    allergens: ing.allergens || [],
    flags: ing.flags || [],
    verified: typeof ing.verified === "boolean" ? ing.verified : true,
  }));

  const rawFoodId = food.id || food._id?.toString();
  const rawSellerId = food.sellerId || food.seller_id || food.seller?.id || "seller_1";

  return {
    food_id: objectIdToUuid(rawFoodId),
    seller_id: objectIdToUuid(rawSellerId),
    name: food.name,
    cuisine: food.cuisine ? food.cuisine.toLowerCase() : "bangladeshi",
    meal_types: (food.mealTypes || [food.category?.toLowerCase() || "lunch"]).filter(Boolean),
    dietary_tags: (food.dietaryTags || ["halal"]).map((t: string) => t.toLowerCase()),
    goal_tags: (food.goalTags || [food.subcategory?.toLowerCase() || "healthy"]).filter(Boolean),
    ingredients,
    rating: typeof food.rating === "number" ? food.rating : 4.5,
    popularity_score: typeof food.popularityScore === "number" ? food.popularityScore : 0.8,
    distance_km: typeof food.distanceKm === "number" ? food.distanceKm : 2.0,
    available: food.status === FoodStatus.PUBLISHED || food.available === true,
  };
};


export const mapRecipeToRecipe = (recipe: any): Recipe => {
  const rawIngredients = Array.isArray(recipe.ingredients) ? recipe.ingredients : [];
  const ingredients: IngredientAmount[] = rawIngredients.map((ing: any) => ({
    ingredient_id: ing.ingredient_id || ing.id || ing.name?.toLowerCase().replace(/\s+/g, "_") || "unknown",
    name: ing.name || "Unknown Ingredient",
    quantity: typeof ing.quantity === "number" ? ing.quantity : 100,
    unit: normalizeUnit(ing.unit || "g"),
    category: ing.category || "other",
    allergens: ing.allergens || [],
    flags: ing.flags || [],
    verified: typeof ing.verified === "boolean" ? ing.verified : true,
  }));

  const rawNutrition = recipe.nutrition_per_serving || recipe.nutritionPerServing || {};
  const rawRecipeId = recipe.id || recipe.recipe_id || recipe._id?.toString();
  const rawSellerId = recipe.sellerId || recipe.seller_id || null;

  return {
    recipe_id: objectIdToUuid(rawRecipeId),
    title: recipe.title || recipe.name || "Recipe",
    cuisine: recipe.cuisine ? recipe.cuisine.toLowerCase() : "bangladeshi",
    meal_types: (recipe.mealTypes || recipe.meal_types || ["lunch", "dinner"]).map((m: string) => m.toLowerCase()),
    dietary_tags: (recipe.dietaryTags || recipe.dietary_tags || ["halal"]).map((t: string) => t.toLowerCase()),
    goal_tags: (recipe.goalTags || recipe.goal_tags || ["healthy"]).map((t: string) => t.toLowerCase()),
    ingredients,
    servings: typeof recipe.servings === "number" ? recipe.servings : 2,
    prep_time_minutes: typeof recipe.prep_time_minutes === "number" ? recipe.prep_time_minutes : (parseInt(recipe.preparationTime) || 20),
    cook_time_minutes: typeof recipe.cook_time_minutes === "number" ? recipe.cook_time_minutes : 30,
    rating: typeof recipe.rating === "number" ? recipe.rating : 4.7,
    popularity_score: typeof recipe.popularityScore === "number" ? recipe.popularityScore : 0.85,
    nutrition_per_serving: {
      calories: typeof rawNutrition.calories === "number" ? rawNutrition.calories : 450,
      protein_g: typeof rawNutrition.protein_g === "number" ? rawNutrition.protein_g : 30,
      carbs_g: typeof rawNutrition.carbs_g === "number" ? rawNutrition.carbs_g : 55,
      fat_g: typeof rawNutrition.fat_g === "number" ? rawNutrition.fat_g : 12,
      fiber_g: typeof rawNutrition.fiber_g === "number" ? rawNutrition.fiber_g : 6,
      sugar_g: typeof rawNutrition.sugar_g === "number" ? rawNutrition.sugar_g : 3,
      sodium_mg: typeof rawNutrition.sodium_mg === "number" ? rawNutrition.sodium_mg : 450,
    },
    seller_id: rawSellerId ? objectIdToUuid(rawSellerId) : null,
  };
};


export const mapMealPlanToStoredMealPlan = (plan: any): StoredMealPlan => {
  const userIdUuid = objectIdToUuid(plan.userId || plan.user_id || plan.user?.id);
  const rawPlanId = plan.planId || plan.plan_id || plan.id || plan._id?.toString();
  const rawDays = Array.isArray(plan.days) ? plan.days : [];
  const days: MealPlanDay[] = rawDays.map((day: any) => ({
    date: day.date || new Date().toISOString().split("T")[0],
    meals: (day.meals || []).map((m: any, idx: number) => ({
      meal_item_id: m.meal_item_id || m.id || `mpi_${idx + 1}`,
      meal_type: (m.meal_type || m.mealType || "lunch").toLowerCase(),
      recipe_id: objectIdToUuid(m.recipe_id || m.recipeId || "r1"),
      servings: typeof m.servings === "number" && m.servings > 0 ? m.servings : 2,
    })),
  }));

  return {
    plan_id: rawPlanId,
    user_id: userIdUuid,
    version: plan.version || 1,
    days,
  };
};


export const mapSellerFoodToSellerFoodDraft = (draft: any): SellerFoodDraft => {
  const sellerUserUuid = objectIdToUuid(
    draft.sellerId || draft.sellerUserId || draft.seller_user_id || draft.userId || draft.seller?.id,
  );
  const rawFoodId = draft.id || draft.food_id || draft._id?.toString();
  const rawSellerId = draft.sellerId || draft.seller_id || draft.seller?.sellerProfile?.id || "seller_1";
  const rawIngredients = Array.isArray(draft.ingredients) ? draft.ingredients : [];
  const ingredients: IngredientAmount[] = rawIngredients.map((ing: any) => ({
    ingredient_id: ing.ingredient_id || ing.id || ing.name?.toLowerCase().replace(/\s+/g, "_") || "unknown",
    name: ing.name || "Unknown Ingredient",
    quantity: typeof ing.quantity === "number" ? ing.quantity : 100,
    unit: normalizeUnit(ing.unit || "g"),
    category: ing.category || "other",
    allergens: ing.allergens || [],
    flags: ing.flags || [],
    verified: typeof ing.verified === "boolean" ? ing.verified : true,
  }));

  return {
    food_id: objectIdToUuid(rawFoodId),
    seller_user_id: sellerUserUuid,
    seller_id: objectIdToUuid(rawSellerId),
    name: draft.name || draft.title || "Food Item Draft",
    cuisine: draft.cuisine ? draft.cuisine.toLowerCase() : "bangladeshi",
    servings: typeof draft.servings === "number" ? draft.servings : 4,
    prep_time_minutes: typeof draft.prep_time_minutes === "number" ? draft.prep_time_minutes : (parseInt(draft.preparationTime) || 20),
    cook_time_minutes: typeof draft.cook_time_minutes === "number" ? draft.cook_time_minutes : 40,
    preparation_notes: draft.preparation_notes || draft.preparationNotes || null,
    cooking_method: draft.cooking_method || draft.cookingMethod || null,
    ingredients,
    details: draft.details || draft.description || null,
  };
};
