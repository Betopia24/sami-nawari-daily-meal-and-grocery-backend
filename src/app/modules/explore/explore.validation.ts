import { z } from "zod";
import { CuisineType, FoodCategory } from "@prisma/client";

const getNearbySellersSchema = z.object({
  searchTerm: z.string().optional(),
  cuisine: z
    .nativeEnum(CuisineType, {
      message: `Invalid cuisine. Must be one of: ${Object.values(CuisineType).join(", ")}`,
    })
    .optional(),
  deliveryAvailable: z
    .string()
    .optional()
    .transform((val) => (val === "true" ? true : val === "false" ? false : undefined)),
  pickupAvailable: z
    .string()
    .optional()
    .transform((val) => (val === "true" ? true : val === "false" ? false : undefined)),
  latitude: z
    .string()
    .optional()
    .transform((val) => (val ? parseFloat(val) : undefined))
    .refine((val) => val === undefined || (!isNaN(val) && val >= -90 && val <= 90), {
      message: "Latitude must be a valid number between -90 and 90",
    }),
  longitude: z
    .string()
    .optional()
    .transform((val) => (val ? parseFloat(val) : undefined))
    .refine((val) => val === undefined || (!isNaN(val) && val >= -180 && val <= 180), {
      message: "Longitude must be a valid number between -180 and 180",
    }),
  radius: z
    .string()
    .optional()
    .transform((val) => (val ? parseFloat(val) : 5000))
    .refine((val) => !isNaN(val) && val > 0 && val <= 50000, {
      message: "Radius must be a positive number",
    }),

  page: z
    .string()
    .optional()
    .transform((val) => Math.max(1, parseInt(val ?? "1") || 1)),
  limit: z
    .string()
    .optional()
    .transform((val) => Math.min(50, Math.max(1, parseInt(val ?? "10") || 10))),
});

const getSellerMenuSchema = z.object({
  category: z
    .nativeEnum(FoodCategory, {
      message: `Invalid category. Must be one of: ${Object.values(FoodCategory).join(", ")}`,
    })
    .optional(),
  page: z
    .string()
    .optional()
    .transform((val) => Math.max(1, parseInt(val ?? "1") || 1)),
  limit: z
    .string()
    .optional()
    .transform((val) => Math.min(50, Math.max(1, parseInt(val ?? "10") || 10))),
});

const getSellerReviewsSchema = z.object({
  page: z
    .string()
    .optional()
    .transform((val) => Math.max(1, parseInt(val ?? "1") || 1)),
  limit: z
    .string()
    .optional()
    .transform((val) => Math.min(50, Math.max(1, parseInt(val ?? "10") || 10))),
});

export const exploreValidation = {
  getNearbySellersSchema,
  getSellerMenuSchema,
  getSellerReviewsSchema,
};
