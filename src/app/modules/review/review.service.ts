/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { OrderStatus, UserRole, ReviewStatus } from "@prisma/client";
import ApiError from "../../errors/apiError";
import { prisma } from "../../prisma/prisma";
import { TCreateReviewPayload, TUpdateReviewPayload } from "./review.interface";
import { PrismaQueryBuilder } from "../../utils/QueryBuilder";

const submitReview = async (userId: string, payload: TCreateReviewPayload) => {
  const order = await prisma.order.findUnique({
    where: { id: payload.orderId },
  });

  if (!order) {
    throw new ApiError(404, "Order not found");
  }

  if (order.userId !== userId) {
    throw new ApiError(403, "You are not authorized to review this order");
  }

  if (order.status !== OrderStatus.DELIVERED && order.status !== OrderStatus.COMPLETED) {
    throw new ApiError(400, "You can only review items from delivered or completed orders");
  }

  const hasFoodItem = order.items.some((item) => item.foodId === payload.foodId);
  if (!hasFoodItem) {
    throw new ApiError(400, "The food item was not purchased in this order");
  }

  const existingReview = await prisma.review.findUnique({
    where: {
      userId_orderId_foodId: {
        userId,
        orderId: payload.orderId,
        foodId: payload.foodId,
      },
    },
  });

  if (existingReview) {
    throw new ApiError(400, "You have already reviewed this item for this order. You can edit your existing review.");
  }

  const result = await prisma.review.create({
    data: {
      userId,
      orderId: payload.orderId,
      foodId: payload.foodId,
      rating: payload.rating,
      comment: payload.comment,
    },
  });

  // Automatically update seller's averageRating & reviewCount
  const food = await prisma.food.findUnique({
    where: { id: payload.foodId },
    select: { sellerId: true },
  });
  if (food?.sellerId) {
    updateSellerRatingStats(food.sellerId).catch((err) =>
      console.error("Failed to update seller rating stats:", err)
    );
  }

  return result;
};

const updateSellerRatingStats = async (sellerId: string) => {
  try {
    const sellerFoods = await prisma.food.findMany({
      where: { sellerId },
      select: { id: true },
    });
    const foodIds = sellerFoods.map((f) => f.id);

    const aggregation = await prisma.review.aggregate({
      where: {
        foodId: { in: foodIds },
        status: ReviewStatus.PUBLISHED,
      },
      _avg: { rating: true },
      _count: { rating: true },
    });

    const averageRating = aggregation._avg.rating ? parseFloat(aggregation._avg.rating.toFixed(1)) : 0;
    const reviewCount = aggregation._count.rating || 0;

    await prisma.sellerProfile.update({
      where: { userId: sellerId },
      data: {
        averageRating,
        reviewCount,
      },
    });
  } catch (error) {
    console.error(`Error updating rating stats for seller ${sellerId}:`, error);
  }
};

const updateReview = async (userId: string, reviewId: string, payload: TUpdateReviewPayload) => {
  const review = await prisma.review.findUnique({
    where: { id: reviewId },
  });

  if (!review) {
    throw new ApiError(404, "Review not found");
  }

  if (review.userId !== userId) {
    throw new ApiError(403, "You are not authorized to update this review");
  }

  // Fix #2: Only allow safe, explicit fields — prevent unauthorized field injection
  const result = await prisma.review.update({
    where: { id: reviewId },
    data: {
      ...(payload.rating !== undefined && { rating: payload.rating }),
      ...(payload.comment !== undefined && { comment: payload.comment }),
    },
  });

  const food = await prisma.food.findUnique({
    where: { id: review.foodId },
    select: { sellerId: true },
  });
  if (food?.sellerId) {
    updateSellerRatingStats(food.sellerId).catch((err) =>
      console.error("Failed to update seller rating stats after review update:", err)
    );
  }

  return result;
};

const deleteReview = async (userId: string, userRole: UserRole, reviewId: string) => {
  const review = await prisma.review.findUnique({
    where: { id: reviewId },
  });

  if (!review) {
    throw new ApiError(404, "Review not found");
  }

  if (review.userId !== userId && userRole !== UserRole.ADMIN) {
    throw new ApiError(403, "You are not authorized to delete this review");
  }

  const result = await prisma.review.delete({
    where: { id: reviewId },
  });

  const food = await prisma.food.findUnique({
    where: { id: review.foodId },
    select: { sellerId: true },
  });
  if (food?.sellerId) {
    updateSellerRatingStats(food.sellerId).catch((err) =>
      console.error("Failed to update seller rating stats after review delete:", err)
    );
  }

  return result;
};

const getFoodReviews = async (foodId: string, query: Record<string, any>) => {
  // Fix #1: Do NOT use .filter() to avoid unexpected query string fields leaking into where clause
  const qb = new PrismaQueryBuilder(query).sort().paginate();
  const prismaQuery = qb.build();

  // Enforce only safe, controlled filters
  const baseWhere = {
    foodId,
    status: ReviewStatus.PUBLISHED,
  };

  // Fix #4: Exclude `select` from spread to avoid conflict with `include`
  const { select: _select, ...restPrismaQuery } = prismaQuery;

  // Fix #3: Run all DB calls concurrently with a single Promise.all
  const [reviews, total, aggregation, starCounts] = await Promise.all([
    prisma.review.findMany({
      ...restPrismaQuery,
      where: baseWhere,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            profilePicture: true,
          },
        },
      },
    }),
    prisma.review.count({ where: baseWhere }),
    prisma.review.aggregate({
      where: baseWhere,
      _avg: { rating: true },
      _count: { rating: true },
    }),
    prisma.review.groupBy({
      by: ["rating"],
      where: baseWhere,
      _count: { rating: true },
    }),
  ]);

  const distribution: Record<string, number> = {
    "5": 0,
    "4": 0,
    "3": 0,
    "2": 0,
    "1": 0,
  };

  starCounts.forEach((item: any) => {
    const star = item.rating.toString();
    if (star in distribution) {
      distribution[star] = item._count.rating;
    }
  });

  const averageRating = aggregation._avg.rating ? parseFloat(aggregation._avg.rating.toFixed(1)) : 0;
  const totalReviews = aggregation._count.rating || 0;

  return {
    summary: {
      averageRating,
      totalReviews,
      ratingDistribution: distribution,
    },
    reviews,
    meta: qb.getMeta(total),
  };
};

export const ReviewService = {
  submitReview,
  updateReview,
  deleteReview,
  getFoodReviews,
};
