export interface IngredientAmount {
  ingredient_id: string;
  name: string;
  quantity: number;
  unit: string;
  category?: string;
  allergens?: string[];
  flags?: string[];
  verified?: boolean;
}

export interface UserAIProfile {
  user_id: string;
  profile_version: number;
  dietary_preferences: string[];
  allergies: string[];
  preferred_cuisines: string[];
  nutrition_goal: string | null;
  household_size: number;
  cooking_frequency: string | null;
  language: string;
  favorite_seller_ids: string[];
  behavior_affinity: Record<string, number>;
}

export interface FoodItem {
  food_id: string;
  seller_id: string;
  name: string;
  cuisine: string | null;
  meal_types: string[];
  dietary_tags: string[];
  goal_tags: string[];
  ingredients: IngredientAmount[];
  rating: number;
  popularity_score: number;
  distance_km: number | null;
  available: boolean;
}

export interface NutritionFacts {
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g: number;
  sugar_g: number;
  sodium_mg: number;
}

export interface Recipe {
  recipe_id: string;
  title: string;
  cuisine: string | null;
  meal_types: string[];
  dietary_tags: string[];
  goal_tags: string[];
  ingredients: IngredientAmount[];
  servings: number;
  prep_time_minutes: number;
  cook_time_minutes: number;
  rating: number;
  popularity_score: number;
  nutrition_per_serving: NutritionFacts;
  seller_id: string | null;
}

export interface MealPlanItem {
  meal_item_id?: string;
  meal_type: string;
  recipe_id: string;
  servings: number;
}

export interface MealPlanDay {
  date: string;
  meals: MealPlanItem[];
}

export interface StoredMealPlan {
  plan_id: string;
  user_id: string;
  version: number;
  days: MealPlanDay[];
}

export interface SellerFoodDraft {
  food_id: string;
  seller_user_id: string; 
  seller_id: string;
  name: string;
  cuisine: string | null;
  servings: number;
  prep_time_minutes: number;
  cook_time_minutes: number;
  preparation_notes: string | null;
  cooking_method: string | null;
  ingredients: IngredientAmount[];
  details: string | null;
}


export interface CanonicalDataWrapper<T> {
  data: T;
}
