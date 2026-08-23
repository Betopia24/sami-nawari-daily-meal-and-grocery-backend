/* eslint-disable @typescript-eslint/no-explicit-any */
import { Request, Response } from "express";
import catchAsync from "../../utils/catchAsync";
import sendResponse from "../../utils/sendResponse";
import { GroceryService } from "./grocery.service";

const createGroceryList = catchAsync(async (req: Request & { user?: any }, res: Response) => {
  const decodedUser = req.user as any;
  const result = await GroceryService.createGroceryList(decodedUser.userId, req.body);

  sendResponse(res, {
    statusCode: 201,
    success: true,
    message: "Grocery list created successfully",
    data: result,
  });
});

const getAllGroceryLists = catchAsync(async (req: Request & { user?: any }, res: Response) => {
  const decodedUser = req.user as any;
  const searchTerm = req.query.searchTerm as string;
  const result = await GroceryService.getAllGroceryLists(decodedUser.userId, searchTerm);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Grocery lists retrieved successfully",
    data: result,
  });
});

const getGroceryListById = catchAsync(async (req: Request & { user?: any }, res: Response) => {
  const decodedUser = req.user as any;
  const groceryListId = req.params.groceryListId;
  const result = await GroceryService.getGroceryListById(groceryListId as string, decodedUser.userId);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Grocery list details retrieved successfully",
    data: result,
  });
});

const updateGroceryList = catchAsync(async (req: Request & { user?: any }, res: Response) => {
  const decodedUser = req.user as any;
  const groceryListId = req.params.groceryListId;
  const result = await GroceryService.updateGroceryList(groceryListId as string, decodedUser.userId, req.body);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Grocery list updated successfully",
    data: result,
  });
});

const deleteGroceryList = catchAsync(async (req: Request & { user?: any }, res: Response) => {
  const decodedUser = req.user as any;
  const groceryListId = req.params.groceryListId;
  const result = await GroceryService.deleteGroceryList(groceryListId as string, decodedUser.userId);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Grocery list deleted successfully",
    data: result,
  });
});

const addGroceryItem = catchAsync(async (req: Request & { user?: any }, res: Response) => {
  const decodedUser = req.user as any;
  const groceryListId = req.params.groceryListId;
  const result = await GroceryService.addGroceryItem(groceryListId as string, decodedUser.userId, req.body);

  sendResponse(res, {
    statusCode: 201,
    success: true,
    message: "Item added to grocery list successfully",
    data: result,
  });
});

const updateGroceryItem = catchAsync(async (req: Request & { user?: any }, res: Response) => {
  const decodedUser = req.user as any;
  const groceryListId = req.params.groceryListId;
  const itemId = req.params.itemId;
  const result = await GroceryService.updateGroceryItem(groceryListId as string, itemId as string, decodedUser.userId, req.body);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Grocery item updated successfully",
    data: result,
  });
});

const deleteGroceryItem = catchAsync(async (req: Request & { user?: any }, res: Response) => {
  const decodedUser = req.user as any;
  const groceryListId = req.params.groceryListId;
  const itemId = req.params.itemId;
  const result = await GroceryService.deleteGroceryItem(groceryListId as string, itemId as string, decodedUser.userId);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Grocery item deleted successfully",
    data: result,
  });
});

const inviteMember = catchAsync(async (req: Request & { user?: any }, res: Response) => {
  const decodedUser = req.user as any;
  const groceryListId = req.params.groceryListId;
  const result = await GroceryService.inviteMember(groceryListId as string, decodedUser.userId, req.body);

  sendResponse(res, {
    statusCode: 201,
    success: true,
    message: "Invitation sent successfully",
    data: result,
  });
});

const getMyInvitations = catchAsync(async (req: Request & { user?: any }, res: Response) => {
  const decodedUser = req.user as any;
  const result = await GroceryService.getMyInvitations(decodedUser.email);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Pending invitations retrieved successfully",
    data: result,
  });
});

const respondInvitation = catchAsync(async (req: Request & { user?: any }, res: Response) => {
  const decodedUser = req.user as any;
  const invitationId = req.params.invitationId;
  const result = await GroceryService.respondInvitation(
    invitationId as string,
    decodedUser.userId as string,
    decodedUser.email as string,
    req.body.status
  );

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Invitation response processed successfully",
    data: result,
  });
});

const updateMemberRole = catchAsync(async (req: Request & { user?: any }, res: Response) => {
  const decodedUser = req.user as any;
  const groceryListId = req.params.groceryListId;
  const memberId = req.params.memberId;
  const result = await GroceryService.updateMemberRole(
    groceryListId as string,
    memberId as string,
    decodedUser.userId as string,
    req.body.role
  );

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Member permission level updated successfully",
    data: result,
  });
});

const removeMember = catchAsync(async (req: Request & { user?: any }, res: Response) => {
  const decodedUser = req.user as any;
  const groceryListId = req.params.groceryListId;
  const memberId = req.params.memberId;
  const result = await GroceryService.removeMember(groceryListId as string, memberId as string, decodedUser.userId as string);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: result.message,
    data: null,
  });
});

export const GroceryController = {
  createGroceryList,
  getAllGroceryLists,
  getGroceryListById,
  updateGroceryList,
  deleteGroceryList,
  addGroceryItem,
  updateGroceryItem,
  deleteGroceryItem,
  inviteMember,
  getMyInvitations,
  respondInvitation,
  updateMemberRole,
  removeMember,
};
