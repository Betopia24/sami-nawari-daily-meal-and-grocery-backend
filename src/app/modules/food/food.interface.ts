import { FoodCategory } from "@prisma/client";

export interface TIngredient {
  name: string;
  quantity: number;
  unit: string;
}

export interface TCreateFoodPayload {
  name: string;
  description: string;
  images: string[];
  category: FoodCategory;
  price: number;
  preparationTime: string;
  ingredients: TIngredient[];
  pickupAvailable?: boolean;
  deliveryAvailable?: boolean;
  deliveryFee?: number;
}

export interface TUpdateFoodPayload {
  name?: string;
  description?: string;
  images?: string[];
  category?: FoodCategory;
  price?: number;
  preparationTime?: string;
  ingredients?: TIngredient[];
  pickupAvailable?: boolean;
  deliveryAvailable?: boolean;
  deliveryFee?: number;
}
