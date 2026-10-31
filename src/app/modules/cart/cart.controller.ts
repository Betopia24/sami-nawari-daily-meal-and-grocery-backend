import ApiError from "../../errors/apiError";
/* eslint-disable @typescript-eslint/no-explicit-any */
import { Request, Response } from "express";
import catchAsync from "../../utils/catchAsync";
import sendResponse from "../../utils/sendResponse";
import { CartService } from "./cart.service";

const addItemToCart = catchAsync(async (req: Request & { user?: any }, res: Response) => {
  const decodedUser = req.user as any;

  if (decodedUser?.role === "SELLER") {
    throw new ApiError(
      403,
      "Sellers cannot add items to cart. Please switch to Buyer mode first, then add to cart."
    );
  }

  const result = await CartService.addItemToCart(decodedUser.userId, req.body);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: result.message,
    data: result,
  });
});

const getCart = catchAsync(async (req: Request & { user?: any }, res: Response) => {
  const decodedUser = req.user as any;
  const result = await CartService.getCart(decodedUser.userId);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Cart retrieved successfully",
    data: result,
  });
});

const updateItemQuantity = catchAsync(async (req: Request & { user?: any }, res: Response) => {
  const decodedUser = req.user as any;
  const result = await CartService.updateItemQuantity(decodedUser.userId, req.body);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: result.message,
    data: result,
  });
});

const removeItemFromCart = catchAsync(async (req: Request & { user?: any }, res: Response) => {
  const decodedUser = req.user as any;
  const result = await CartService.removeItemFromCart(decodedUser.userId, req.params.foodId as string);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: result.message,
    data: result,
  });
});

const clearCart = catchAsync(async (req: Request & { user?: any }, res: Response) => {
  const decodedUser = req.user as any;
  const result = await CartService.clearCart(decodedUser.userId);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: result.message,
    data: result,
  });
});

export const CartController = {
  addItemToCart,
  getCart,
  updateItemQuantity,
  removeItemFromCart,
  clearCart,
};
