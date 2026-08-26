import { z } from "zod";

const objectIdRegex = /^[a-f\d]{24}$/i;

const createReviewSchema = z.object({
  orderId: z
    .string()
    .min(1, "Order ID is required")
    .regex(objectIdRegex, "Invalid Order ID format"),
  foodId: z
    .string()
    .min(1, "Food ID is required")
    .regex(objectIdRegex, "Invalid Food ID format"),
  rating: z
    .number()
    .int("Rating must be a whole number")
    .min(1, "Rating must be at least 1 star")
    .max(5, "Rating cannot exceed 5 stars"),
  comment: z.string().min(1, "Comment is required"),
});

const updateReviewSchema = z.object({
  rating: z
    .number()
    .int("Rating must be a whole number")
    .min(1, "Rating must be at least 1 star")
    .max(5, "Rating cannot exceed 5 stars")
    .optional(),
  comment: z.string().min(1, "Comment cannot be empty").optional(),
});

export const reviewValidation = {
  createReviewSchema,
  updateReviewSchema,
};
