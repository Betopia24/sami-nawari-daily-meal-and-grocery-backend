import { UserRole } from "@prisma/client";
import express from "express";
import auth from "../../middlewares/auth";
import validateRequest from "../../middlewares/validateRequest";
import { GroceryController } from "./grocery.controller";
import { groceryValidation } from "./grocery.validation";

const router = express.Router();


router.get(
  "/",
  auth(UserRole.BUYER),
  GroceryController.getAllGroceryLists
);

router.get(
  "/invitations",
  auth(UserRole.BUYER),
  GroceryController.getMyInvitations
);

router.get(
  "/:groceryListId",
  auth(UserRole.BUYER),
  GroceryController.getGroceryListById
);



router.post(
  "/",
  auth(UserRole.BUYER),
  validateRequest(groceryValidation.createGroceryListSchema),
  GroceryController.createGroceryList
);

router.post(
  "/:groceryListId/item",
  auth(UserRole.BUYER),
  validateRequest(groceryValidation.createGroceryItemSchema),
  GroceryController.addGroceryItem
);

router.post(
  "/:groceryListId/invite",
  auth(UserRole.BUYER),
  validateRequest(groceryValidation.inviteMemberSchema),
  GroceryController.inviteMember
);



router.patch(
  "/invitations/:invitationId/respond",
  auth(UserRole.BUYER),
  validateRequest(groceryValidation.respondInvitationSchema),
  GroceryController.respondInvitation
);

router.patch(
  "/:groceryListId",
  auth(UserRole.BUYER),
  validateRequest(groceryValidation.createGroceryListSchema.partial()),
  GroceryController.updateGroceryList
);

router.patch(
  "/:groceryListId/item/:itemId",
  auth(UserRole.BUYER),
  validateRequest(groceryValidation.updateGroceryItemSchema),
  GroceryController.updateGroceryItem
);

router.patch(
  "/:groceryListId/member/:memberId",
  auth(UserRole.BUYER),
  validateRequest(groceryValidation.updateMemberRoleSchema),
  GroceryController.updateMemberRole
);



router.delete(
  "/:groceryListId",
  auth(UserRole.BUYER),
  GroceryController.deleteGroceryList
);

router.delete(
  "/:groceryListId/item/:itemId",
  auth(UserRole.BUYER),
  GroceryController.deleteGroceryItem
);

router.delete(
  "/:groceryListId/member/:memberId",
  auth(UserRole.BUYER),
  GroceryController.removeMember
);

export const GroceryRoutes = router;
