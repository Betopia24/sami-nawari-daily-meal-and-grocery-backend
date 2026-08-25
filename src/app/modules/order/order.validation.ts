import { OrderStatus, PaymentMethod, PaymentStatus } from "@prisma/client";
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
  paymentMethod: z.nativeEnum(PaymentMethod, {
    message: "Payment method must be CASH_ON_DELIVERY or ONLINE",
  }),
});

const updateStatusSchema = z.object({
  status: z.nativeEnum(OrderStatus),
});

const adminUpdateStatusSchema = z.object({
  status: z.nativeEnum(OrderStatus).optional(),
  paymentStatus: z.nativeEnum(PaymentStatus).optional(),
});

const updatePaymentStatusSchema = z.object({
  paymentStatus: z.nativeEnum(PaymentStatus, {
    message: "Payment status must be PENDING, PAID, FAILED, CANCELLED, or UNPAID",
  }),
});

export const orderValidation = {
  createOrderSchema,
  updateStatusSchema,
  adminUpdateStatusSchema,
  updatePaymentStatusSchema,
};
