import { z } from "zod";

const createCheckoutSessionSchema = z.object({
  orderId: z.string().min(1, "orderId cannot be empty"),
});

const retryPaymentSchema = z.object({
  orderId: z.string().min(1, "orderId cannot be empty"),
});

export const paymentValidation = {
  createCheckoutSessionSchema,
  retryPaymentSchema,
};
