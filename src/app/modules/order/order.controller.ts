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

const reorderOrder = catchAsync(async (req: Request & { user?: any }, res: Response) => {
  const decodedUser = req.user as any;
  const orderId = req.params.id as string;
  const result = await OrderService.reorder(decodedUser.userId as string, orderId);

  sendResponse(res, {
    statusCode: 201,
    success: true,
    message: "Reorder placed successfully",
    data: result,
  });
});

const getSellerOrders = catchAsync(async (req: Request & { user?: any }, res: Response) => {
  const decodedUser = req.user as any;
  const result = await OrderService.getSellerOrders(decodedUser.userId as string, req.query);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Seller orders retrieved successfully",
    data: result,
  });
});

const getSellerOrderById = catchAsync(async (req: Request & { user?: any }, res: Response) => {
  const decodedUser = req.user as any;
  const orderId = req.params.id as string;
  const result = await OrderService.getSellerOrderById(decodedUser.userId as string, orderId);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Seller order details retrieved successfully",
    data: result,
  });
});

const updateOrderStatus = catchAsync(async (req: Request & { user?: any }, res: Response) => {
  const decodedUser = req.user as any;
  const orderId = req.params.id as string;
  const result = await OrderService.updateOrderStatus(
    decodedUser.userId as string,
    orderId,
    req.body.status
  );

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Order status updated successfully",
    data: result,
  });
});

const getAllOrders = catchAsync(async (req: Request, res: Response) => {
  const result = await OrderService.getAllOrders(req.query);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "All orders retrieved successfully",
    data: result,
  });
});

const getAdminOrderById = catchAsync(async (req: Request, res: Response) => {
  const orderId = req.params.id as string;
  const result = await OrderService.getAdminOrderById(orderId);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Admin order details retrieved successfully",
    data: result,
  });
});

const getOrderStatistics = catchAsync(async (req: Request, res: Response) => {
  const result = await OrderService.getOrderStatistics();

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Order statistics retrieved successfully",
    data: result,
  });
});

const adminUpdatePaymentStatus = catchAsync(async (req: Request, res: Response) => {
  const orderId = req.params.id as string;
  const result = await OrderService.adminUpdatePaymentStatus(orderId, req.body);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Order payment status updated successfully",
    data: result,
  });
});

export const OrderController = {
  createOrder,
  getMyOrders,
  getOrderById,
  cancelOrder,
  reorderOrder,
  getSellerOrders,
  getSellerOrderById,
  updateOrderStatus,
  getAllOrders,
  getAdminOrderById,
  getOrderStatistics,
  adminUpdatePaymentStatus,
};
