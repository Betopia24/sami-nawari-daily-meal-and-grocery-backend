import { z } from "zod";

const addToCartSchema = z.object({
  foodId: z.string().min(1, "Food ID is required"),
  quantity: z.number().int("Quantity must be an integer").positive("Quantity must be a positive number"),
});

const updateQuantitySchema = z.object({
  foodId: z.string().min(1, "Food ID is required"),
  action: z.enum(["increase", "decrease"]),
});

export const cartValidation = {
  addToCartSchema,
  updateQuantitySchema,
};
