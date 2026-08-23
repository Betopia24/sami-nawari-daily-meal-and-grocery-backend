/* eslint-disable @typescript-eslint/no-explicit-any */
import { Request, Response } from "express";
import catchAsync from "../../utils/catchAsync";
import sendResponse from "../../utils/sendResponse";
import { OrderService } from "./order.service";

const createOrder = catchAsync(async (req: Request & { user?: any }, res: Response) => {
  const decodedUser = req.user as any;
  const result = await OrderService.createOrder(decodedUser.userId as string, req.body);

  sendResponse(res, {
    statusCode: 201,
    success: true,
    message: "Order placed successfully",
    data: result,
  });
});

const getMyOrders = catchAsync(async (req: Request & { user?: any }, res: Response) => {
  const decodedUser = req.user as any;
  const result = await OrderService.getMyOrders(decodedUser.userId as string, req.query);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Orders retrieved successfully",
    data: result,
  });
});

const getOrderById = catchAsync(async (req: Request & { user?: any }, res: Response) => {
  const decodedUser = req.user as any;
  const orderId = req.params.id as string;
  const result = await OrderService.getOrderById(decodedUser.userId as string, orderId);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Order details retrieved successfully",
    data: result,
  });
});

const cancelOrder = catchAsync(async (req: Request & { user?: any }, res: Response) => {
  const decodedUser = req.user as any;
  const orderId = req.params.id as string;
  const result = await OrderService.cancelOrder(decodedUser.userId as string, orderId);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Order cancelled successfully",
    data: result,
  });
});

export const OrderController = {
  createOrder,
  getMyOrders,
  getOrderById,
  cancelOrder,
};
