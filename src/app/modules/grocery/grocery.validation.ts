import { z } from "zod";
import { GroceryPriority, GroceryUnit, GroceryCategory, GroceryRole } from "@prisma/client";

const normalizeUnit = (val: unknown) => {
  if (typeof val === "string") {
    const clean = val.trim().toUpperCase();
    if (clean.includes("PCS") || clean.includes("PIECE")) return GroceryUnit.PCS;
    return clean;
  }
  return val;
};

const normalizePriority = (val: unknown) => {
  if (typeof val === "string") {
    return val.trim().toUpperCase().replace(/\s+/g, "_");
  }
  return val;
};

const normalizeCategory = (val: unknown) => {
  if (typeof val === "string") {
    return val.trim().toUpperCase().replace(/\s+/g, "_");
  }
  return val;
};

const groceryUnitSchema = z.preprocess(normalizeUnit, z.nativeEnum(GroceryUnit));
const groceryPrioritySchema = z.preprocess(normalizePriority, z.nativeEnum(GroceryPriority));
const groceryCategorySchema = z.preprocess(normalizeCategory, z.nativeEnum(GroceryCategory));

const createGroceryListSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
});

const createGroceryItemSchema = z.object({
  name: z.string().min(1, "Name is required"),
  quantity: z.number().positive("Quantity must be greater than 0").optional().default(1),
  unit: groceryUnitSchema.optional().default(GroceryUnit.PCS),
  category: groceryCategorySchema.optional().default(GroceryCategory.OTHER),
  priority: groceryPrioritySchema.optional().default(GroceryPriority.NO_PRIORITY),
  notes: z.string().optional(),
});

const updateGroceryItemSchema = z.object({
  name: z.string().min(1).optional(),
  quantity: z.number().positive("Quantity must be greater than 0").optional(),
  unit: groceryUnitSchema.optional(),
  category: groceryCategorySchema.optional(),
  priority: groceryPrioritySchema.optional(),
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
