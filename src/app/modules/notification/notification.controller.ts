/* eslint-disable @typescript-eslint/no-explicit-any */
import { Request, Response } from "express";
import catchAsync from "../../utils/catchAsync";
import sendResponse from "../../utils/sendResponse";
import { NotificationService } from "./notification.service";

const getMyNotifications = catchAsync(async (req: Request & { user?: any }, res: Response) => {
  const decodedUser = req.user as any;
  const result = await NotificationService.getMyNotifications(decodedUser.userId);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Notifications retrieved successfully",
    data: result,
  });
});

const markAsRead = catchAsync(async (req: Request & { user?: any }, res: Response) => {
  const decodedUser = req.user as any;
  const notificationId = req.params.id as string;
  const result = await NotificationService.markAsRead(decodedUser.userId as string, notificationId as string);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Notification marked as read successfully",
    data: result,
  });
});

const markAllAsRead = catchAsync(async (req: Request & { user?: any }, res: Response) => {
  const decodedUser = req.user as any;
  const result = await NotificationService.markAllAsRead(decodedUser.userId);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "All notifications marked as read successfully",
    data: result,
  });
});

export const NotificationController = {
  getMyNotifications,
  markAsRead,
  markAllAsRead,
};
