/* eslint-disable @typescript-eslint/no-explicit-any */
import { FoodStatus, Prisma, UserStatus } from "@prisma/client";
import ApiError from "../../errors/apiError";
import { prisma } from "../../prisma/prisma";
import { PrismaQueryBuilder } from "../../utils/QueryBuilder";
import { TCreateFoodPayload, TUpdateFoodPayload } from "./food.interface";

//* ─── Seller Operations ────────────────────────────────────────────────────────

const createFood = async (sellerId: string, payload: TCreateFoodPayload) => {
  const user = await prisma.user.findUnique({
    where: { id: sellerId },
  });

  if (!user || !user.isSeller) {
    throw new ApiError(403, "Only approved sellers can list food items.");
  }

  if (user.status !== UserStatus.ACTIVE) {
    throw new ApiError(403, "Your account has been suspended. You cannot create food listings.");
  }

  const result = await prisma.food.create({
    data: {
      ...payload,
      ingredients: payload.ingredients as unknown as Prisma.InputJsonValue,
      sellerId,
      status: FoodStatus.PENDING,
    },
  });

  return result;
};

const getSellerFoods = async (sellerId: string, query: Record<string, any>) => {
  const filterQuery = { ...query, sellerId };

  const qb = new PrismaQueryBuilder(filterQuery)
    .filter()
    .search(["name", "description"])
    .sort()
    .paginate();

  const prismaQuery = qb.build();

  const [data, total] = await Promise.all([
    prisma.food.findMany({
      where: prismaQuery.where,
      orderBy: prismaQuery.orderBy,
      skip: prismaQuery.skip,
      take: prismaQuery.take,
    }),
    prisma.food.count({ where: prismaQuery.where }),
  ]);

  return {
    meta: qb.getMeta(total),
    data,
  };
};

const getSellerFoodDetails = async (sellerId: string, foodId: string) => {
  const food = await prisma.food.findFirst({
    where: { id: foodId, sellerId },
  });

  if (!food) {
    throw new ApiError(404, "Food listing not found.");
  }

  return food;
};

const updateSellerFood = async (
  sellerId: string,
  foodId: string,
  payload: TUpdateFoodPayload
) => {
  const food = await prisma.food.findFirst({
    where: { id: foodId, sellerId },
  });

  if (!food) {
    throw new ApiError(404, "Food listing not found.");
  }

  if (food.status === FoodStatus.HIDDEN) {
    throw new ApiError(400, "This food listing has been hidden by an admin and cannot be edited. Please contact support.");
  }

  const { ingredients, ...rest } = payload;

  const updated = await prisma.food.update({
    where: { id: foodId },
    data: {
      ...rest,
      ...(ingredients && {
        ingredients: ingredients as unknown as Prisma.InputJsonValue,
      }),
      status: FoodStatus.PENDING,
    },
  });

  return updated;
};

const deleteSellerFood = async (sellerId: string, foodId: string) => {
  const food = await prisma.food.findFirst({
    where: { id: foodId, sellerId },
  });

  if (!food) {
    throw new ApiError(404, "Food listing not found.");
  }

  const result = await prisma.food.delete({
    where: { id: foodId },
  });

  return result;
};

//* ─── Admin Operations ─────────────────────────────────────────────────

const getAllFoodsAdmin = async (query: Record<string, any>) => {
  const qb = new PrismaQueryBuilder(query)
    .filter()
    .search(["name", "description"])
    .sort()
    .paginate();

  const prismaQuery = qb.build();

  const [data, total] = await Promise.all([
    prisma.food.findMany({
      where: prismaQuery.where,
      orderBy: prismaQuery.orderBy,
      skip: prismaQuery.skip,
      take: prismaQuery.take,
      include: {
        seller: {
          select: {
            id: true,
            name: true,
            email: true,
            profilePicture: true,
            sellerProfile: {
              select: {
                businessName: true,
              },
            },
          },
        },
      },
    }),
    prisma.food.count({ where: prismaQuery.where }),
  ]);

  return {
    meta: qb.getMeta(total),
    data,
  };
};

const reviewFood = async (foodId: string, status: FoodStatus) => {
  const food = await prisma.food.findUnique({
    where: { id: foodId },
  });

  if (!food) {
    throw new ApiError(404, "Food listing not found.");
  }

  if (food.status !== FoodStatus.PENDING) {
    throw new ApiError(400, `Cannot review a food that is already ${food.status.toLowerCase()}.`);
  }

  const result = await prisma.food.update({
    where: { id: foodId },
    data: { status },
  });

  return result;
};

const toggleFoodVisibility = async (foodId: string, status: FoodStatus) => {
  const food = await prisma.food.findUnique({
    where: { id: foodId },
  });

  if (!food) {
    throw new ApiError(404, "Food listing not found.");
  }

  if (food.status === FoodStatus.PENDING || food.status === FoodStatus.REJECTED) {
    throw new ApiError(400, "Can only toggle visibility of approved (published/hidden) foods.");
  }

  const result = await prisma.food.update({
    where: { id: foodId },
    data: { status },
  });

  return result;
};

const deleteFoodAdmin = async (foodId: string) => {
  const food = await prisma.food.findUnique({
    where: { id: foodId },
  });

  if (!food) {
    throw new ApiError(404, "Food listing not found.");
  }

  const result = await prisma.food.delete({
    where: { id: foodId },
  });

  return result;
};

//* ─── Customer Operations ─────────────────────────────────────────

const getPublishedFoods = async (query: Record<string, any>) => {
  const filterQuery = { ...query, status: FoodStatus.PUBLISHED };

  const qb = new PrismaQueryBuilder(filterQuery)
    .filter()
    .search(["name", "description"])
    .rangeFilter()
    .sort()
    .paginate();

  const prismaQuery = qb.build();

  const [data, total] = await Promise.all([
    prisma.food.findMany({
      where: prismaQuery.where,
      orderBy: prismaQuery.orderBy,
      skip: prismaQuery.skip,
      take: prismaQuery.take,
      include: {
        seller: {
          select: {
            id: true,
            name: true,
            profilePicture: true,
            sellerProfile: {
              select: {
                businessName: true,
                address: true,
              },
            },
          },
        },
      },
    }),
    prisma.food.count({ where: prismaQuery.where }),
  ]);

  return {
    meta: qb.getMeta(total),
    data,
  };
};

const getFoodDetails = async (foodId: string) => {
  const food = await prisma.food.findUnique({
    where: { id: foodId },
    include: {
      seller: {
        select: {
          id: true,
          name: true,
          email: true,
          profilePicture: true,
          sellerProfile: {
            select: {
              businessName: true,
              phone: true,
              address: true,
              workingHours: true,
            },
          },
        },
      },
    },
  });

  if (!food) {
    throw new ApiError(404, "Food listing not found.");
  }

  if (food.status !== FoodStatus.PUBLISHED) {
    throw new ApiError(403, "This food listing is not currently available to the public.");
  }

  return food;
};

export const FoodService = {
  createFood,
  getSellerFoods,
  getSellerFoodDetails,
  updateSellerFood,
  deleteSellerFood,
  getAllFoodsAdmin,
  reviewFood,
  toggleFoodVisibility,
  deleteFoodAdmin,
  getPublishedFoods,
  getFoodDetails,
};
