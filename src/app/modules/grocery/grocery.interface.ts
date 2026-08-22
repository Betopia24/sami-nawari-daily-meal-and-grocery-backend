import { GroceryPriority, GroceryUnit, GroceryCategory, GroceryRole, GroceryItemStatus } from "@prisma/client";

export interface TCreateGroceryListPayload {
  name: string;
  description?: string;
}

export interface TCreateGroceryItemPayload {
  name: string;
  quantity?: number;
  unit?: GroceryUnit;
  category?: GroceryCategory;
  priority?: GroceryPriority;
  notes?: string;
}

export interface TUpdateGroceryItemPayload {
  name?: string;
  quantity?: number;
  unit?: GroceryUnit;
  category?: GroceryCategory;
  priority?: GroceryPriority;
  notes?: string;
  status?: GroceryItemStatus;
}

export interface TInviteMemberPayload {
  email: string;
  role?: GroceryRole;
}
