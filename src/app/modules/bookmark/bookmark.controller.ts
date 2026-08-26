/* eslint-disable @typescript-eslint/no-explicit-any */
import { Request, Response } from "express";
import catchAsync from "../../utils/catchAsync";
import sendResponse from "../../utils/sendResponse";
import { BookmarkService } from "./bookmark.service";

const toggleBookmark = catchAsync(async (req: Request & { user?: any }, res: Response) => {
  const { foodId } = req.body;
  const decodedUser = req.user;

  const result = await BookmarkService.toggleBookmark(decodedUser.userId, foodId);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: result.message,
    data: result,
  });
});

const getMyBookmarks = catchAsync(async (req: Request & { user?: any }, res: Response) => {
  const decodedUser = req.user;

  const result = await BookmarkService.getMyBookmarks(decodedUser.userId);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Bookmarks retrieved successfully",
    data: result,
  });
});

export const BookmarkController = {
  toggleBookmark,
  getMyBookmarks,
};
