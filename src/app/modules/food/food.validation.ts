import { z } from "zod";
import { FoodCategory, FoodStatus, FoodSubcategory } from "@prisma/client";

const ingredientSchema = z.object({
  name: z.string().min(1, "Ingredient name is required"),
  quantity: z.number().min(0, "Quantity must be at least 0"),
  unit: z.string().min(1, "Unit is required"),
});

export const categorySubcategoryMap: Record<FoodCategory, FoodSubcategory[]> = {
  [FoodCategory.BREAKFAST]: [
    FoodSubcategory.HEALTHY,
    FoodSubcategory.QUICK,
    FoodSubcategory.TRADITIONAL,
    FoodSubcategory.HIGH_PROTEIN,
  ],
  [FoodCategory.LUNCH]: [
    FoodSubcategory.LIGHT,
    FoodSubcategory.QUICK,
    FoodSubcategory.HEARTY,
    FoodSubcategory.SALADS,
  ],
  [FoodCategory.DINNER]: [
    FoodSubcategory.FAMILY,
    FoodSubcategory.QUICK,
    FoodSubcategory.SPECIAL,
    FoodSubcategory.COMFORT,
  ],
  [FoodCategory.SNACKS]: [
    FoodSubcategory.SWEET,
    FoodSubcategory.SAVORY,
    FoodSubcategory.QUICK,
    FoodSubcategory.HEALTHY,
  ],
  [FoodCategory.DRINKS]: [
    FoodSubcategory.HEALTHY,
    FoodSubcategory.QUICK,
    FoodSubcategory.SPECIAL,
    FoodSubcategory.SWEET,
  ],
  [FoodCategory.SMOOTHIES]: [
    FoodSubcategory.HEALTHY,
    FoodSubcategory.QUICK,
    FoodSubcategory.HIGH_PROTEIN,
    FoodSubcategory.SWEET,
  ],
  [FoodCategory.DESSERT]: [
    FoodSubcategory.SWEET,
    FoodSubcategory.SPECIAL,
    FoodSubcategory.COMFORT,
    FoodSubcategory.TRADITIONAL,
  ],
  [FoodCategory.SANDWICH]: [
    FoodSubcategory.QUICK,
    FoodSubcategory.HEALTHY,
    FoodSubcategory.LIGHT,
    FoodSubcategory.HIGH_PROTEIN,
  ],
};

const createFoodSchema = z.object({
  name: z.string().min(1, "Food name is required"),
  description: z.string().min(10, "Description must be at least 10 characters"),
  images: z.array(z.string()).min(1, "At least one food image is required"),
  category: z.nativeEnum(FoodCategory, {
    message: `Category must be one of: ${Object.values(FoodCategory).join(", ")}`,
  }),
  subcategory: z.nativeEnum(FoodSubcategory).optional(),
  price: z.number().min(0, "Price must be at least 0"),
  preparationTime: z.string().min(1, "Preparation time is required"),
  ingredients: z.array(ingredientSchema).min(1, "At least one ingredient is required"),
  pickupAvailable: z.boolean().optional().default(false),
  deliveryAvailable: z.boolean().optional().default(false),
  deliveryFee: z.number().min(0, "Delivery fee must be at least 0").optional().default(0),
}).refine(
  (data) => {
    if (!data.subcategory) {
      return false;
    }
    const allowed = categorySubcategoryMap[data.category];
    return allowed.includes(data.subcategory);
  },
  {
    message: "Invalid subcategory for the selected category",
    path: ["subcategory"],
  }
);

const updateFoodSchema = z.object({
  name: z.string().optional(),
  description: z.string().min(10).optional(),
  images: z.array(z.string()).optional(),
  category: z.nativeEnum(FoodCategory).optional(),
  subcategory: z.nativeEnum(FoodSubcategory).optional(),
  price: z.number().min(0).optional(),
  preparationTime: z.string().optional(),
  ingredients: z.array(ingredientSchema).optional(),
  pickupAvailable: z.boolean().optional(),
  deliveryAvailable: z.boolean().optional(),
  deliveryFee: z.number().min(0).optional(),
}).refine(
  (data) => {
    if (data.category && data.subcategory) {
      const allowed = categorySubcategoryMap[data.category];
      return allowed.includes(data.subcategory);
    }
    return true;
  },
  {
    message: "Invalid subcategory for the selected category",
    path: ["subcategory"],
  }
);

const reviewFoodSchema = z.object({
  status: z.enum([FoodStatus.PUBLISHED, FoodStatus.REJECTED], {
    message: "Status must be PUBLISHED or REJECTED",
  }),
});

const visibilityFoodSchema = z.object({
  status: z.enum([FoodStatus.PUBLISHED, FoodStatus.HIDDEN], {
    message: "Status must be PUBLISHED or HIDDEN",
  }),
});

export const foodValidation = {
  createFoodSchema,
  updateFoodSchema,
  reviewFoodSchema,
  visibilityFoodSchema,
};
