/* eslint-disable @typescript-eslint/no-explicit-any */
import { Request, Response } from "express";
import catchAsync from "../../utils/catchAsync";
import sendResponse from "../../utils/sendResponse";
import { ReviewService } from "./review.service";

const submitReview = catchAsync(async (req: Request & { user?: any }, res: Response) => {
  const decodedUser = req.user;
  const payload = req.body;

  const result = await ReviewService.submitReview(decodedUser.userId, payload);

  sendResponse(res, {
    statusCode: 201,
    success: true,
    message: "Review submitted successfully",
    data: result,
  });
});

const updateReview = catchAsync(async (req: Request & { user?: any }, res: Response) => {
  const decodedUser = req.user;
  const { id } = req.params;
  const payload = req.body;

  const result = await ReviewService.updateReview(decodedUser.userId, id as string, payload);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Review updated successfully",
    data: result,
  });
});

const deleteReview = catchAsync(async (req: Request & { user?: any }, res: Response) => {
  const decodedUser = req.user;
  const { id } = req.params;

  const result = await ReviewService.deleteReview(decodedUser.userId, decodedUser.role, id as string);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Review deleted successfully",
    data: result,
  });
});

const getFoodReviews = catchAsync(async (req: Request, res: Response) => {
  const { foodId } = req.params;

  const result = await ReviewService.getFoodReviews(foodId as string, req.query);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Reviews retrieved successfully",
    data: result,
  });
});

export const ReviewController = {
  submitReview,
  updateReview,
  deleteReview,
  getFoodReviews,
};
