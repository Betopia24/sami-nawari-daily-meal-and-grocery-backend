import { z } from "zod";
import { GroceryPriority, GroceryUnit, GroceryCategory, GroceryRole } from "@prisma/client";

const createGroceryListSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
});

const createGroceryItemSchema = z.object({
  name: z.string().min(1, "Name is required"),
  quantity: z.number().positive("Quantity must be greater than 0").optional().default(1),
  unit: z.nativeEnum(GroceryUnit).optional().default(GroceryUnit.PCS),
  category: z.nativeEnum(GroceryCategory).optional().default(GroceryCategory.OTHER),
  priority: z.nativeEnum(GroceryPriority).optional().default(GroceryPriority.NO_PRIORITY),
  notes: z.string().optional(),
});

const updateGroceryItemSchema = z.object({
  name: z.string().min(1).optional(),
  quantity: z.number().positive("Quantity must be greater than 0").optional(),
  unit: z.nativeEnum(GroceryUnit).optional(),
  category: z.nativeEnum(GroceryCategory).optional(),
  priority: z.nativeEnum(GroceryPriority).optional(),
  notes: z.string().optional(),
  status: z.enum(["PENDING", "COMPLETED"]).optional(),
});

const inviteMemberSchema = z.object({
  email: z.string().email("Invalid email address"),
  role: z.nativeEnum(GroceryRole).optional().default(GroceryRole.VIEWER),
});

const updateMemberRoleSchema = z.object({
  role: z.nativeEnum(GroceryRole),
});

const respondInvitationSchema = z.object({
  status: z.enum(["ACCEPTED", "DECLINED"]),
});

export const groceryValidation = {
  createGroceryListSchema,
  createGroceryItemSchema,
  updateGroceryItemSchema,
  inviteMemberSchema,
  updateMemberRoleSchema,
  respondInvitationSchema,
};
