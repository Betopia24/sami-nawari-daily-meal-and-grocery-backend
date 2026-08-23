import { z } from "zod";

const deliveryAddressSchema = z.object({
  streetAddress: z.string().min(1, "Street address is required"),
  city: z.string().min(1, "City is required"),
  state: z.string().optional(),
  postalCode: z.string().optional(),
  country: z.string().optional(),
});

const createOrderSchema = z.object({
  deliveryAddress: deliveryAddressSchema,
  recipientName: z.string().min(1, "Recipient name is required"),
  contactPhone: z.string().min(1, "Contact phone is required"),
  note: z.string().optional(),
});

export const orderValidation = {
  createOrderSchema,
};
