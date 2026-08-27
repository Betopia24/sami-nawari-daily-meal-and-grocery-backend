/* eslint-disable @typescript-eslint/no-explicit-any */
import { FoodCategory, FoodStatus, Prisma, UserStatus, FoodSubcategory } from "@prisma/client";
import ApiError from "../../errors/apiError";
import { prisma } from "../../prisma/prisma";
import { PrismaQueryBuilder } from "../../utils/QueryBuilder";
import redis from "../../utils/redisClient";
import { TCreateFoodPayload, TUpdateFoodPayload } from "./food.interface";
import { categorySubcategoryMap } from "./food.validation";

const clearFoodCache = async (foodId?: string) => {
  try {
    if (foodId) {
      await redis.del(`food_details:${foodId}`);
    }
    // Scan and delete keys matching published_foods:* (prevents blocking Redis event loop)
    let cursor = "0";
    do {
      const [nextCursor, keys] = await redis.scan(cursor, "MATCH", "published_foods:*", "COUNT", 100);
      cursor = nextCursor;
      if (keys.length > 0) {
        await redis.del(...keys);
      }
    } while (cursor !== "0");

    // Scan and delete keys matching published_recipes:*
    cursor = "0";
    do {
      const [nextCursor, keys] = await redis.scan(cursor, "MATCH", "published_recipes:*", "COUNT", 100);
      cursor = nextCursor;
      if (keys.length > 0) {
        await redis.del(...keys);
      }
    } while (cursor !== "0");
  } catch (error) {
    console.error("Redis Cache Invalidation Error:", error);
  }
};

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

  await clearFoodCache(foodId);

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

  await clearFoodCache(foodId);

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

  await clearFoodCache(foodId);

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

  await clearFoodCache(foodId);

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

  await clearFoodCache(foodId);

  return result;
};

//* ─── Customer Operations ─────────────────────────────────────────

const getPublishedFoods = async (query: Record<string, any>) => {
  // Sort query keys to ensure consistent cache keys regardless of param order (e.g. page=1&limit=10 and limit=10&page=1 match the same cache)
  const sortedQueryStr = Object.keys(query)
    .sort()
    .map((k) => `${k}=${encodeURIComponent(String(query[k]))}`)
    .join("&");
  const cacheKey = `published_foods:${sortedQueryStr || "default"}`;

  try {
    const cached = await redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }
  } catch (err) {
    console.error("Redis Read Published Foods Cache Error:", err);
  }

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

  const result = {
    meta: qb.getMeta(total),
    data,
  };

  try {
    // Cache listing with 5 minutes (300 seconds) TTL
    await redis.set(cacheKey, JSON.stringify(result), "EX", 300);
  } catch (err) {
    console.error("Redis Write Published Foods Cache Error:", err);
  }

  return result;
};

const getFoodDetails = async (foodId: string) => {
  const cacheKey = `food_details:${foodId}`;

  try {
    const cached = await redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }
  } catch (err) {
    console.error("Redis Read Food Details Cache Error:", err);
  }

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

  try {
    // Cache food details with 10 minutes (600 seconds) TTL
    await redis.set(cacheKey, JSON.stringify(food), "EX", 600);
  } catch (err) {
    console.error("Redis Write Food Details Cache Error:", err);
  }

  return food;
};

const getRecipeByCategory = async (category: string, query: Record<string, any>) => {
  const categoryUpper = String(category).toUpperCase();
  if (!Object.values(FoodCategory).includes(categoryUpper as FoodCategory)) {
    throw new ApiError(
      400,
      `Invalid food category. Allowed values: ${Object.values(FoodCategory).join(", ")}`
    );
  }

  const normalizedQuery: Record<string, any> = {};
  for (const key in query) {
    if (query[key] !== undefined && query[key] !== null && String(query[key]).trim() !== "") {
      normalizedQuery[key] = query[key];
    }
  }

  if (normalizedQuery.subcategory) {
    const subcategoryUpper = String(normalizedQuery.subcategory).toUpperCase();
    if (!Object.values(FoodSubcategory).includes(subcategoryUpper as FoodSubcategory)) {
      throw new ApiError(
        400,
        `Invalid food subcategory. Allowed values: ${Object.values(FoodSubcategory).join(", ")}`
      );
    }
    normalizedQuery.subcategory = subcategoryUpper;

    const allowed = categorySubcategoryMap[categoryUpper as FoodCategory];
    if (!allowed.includes(normalizedQuery.subcategory as FoodSubcategory)) {
      throw new ApiError(
        400,
        `Invalid subcategory for the selected category. Allowed subcategories for ${categoryUpper}: ${allowed.join(", ")}`
      );
    }
  }

  const sortedQueryStr = Object.keys(normalizedQuery)
    .sort()
    .map((k) => `${k}=${encodeURIComponent(String(normalizedQuery[k]))}`)
    .join("&");
  const cacheKey = `published_recipes:${categoryUpper}:${sortedQueryStr || "default"}`;

  try {
    const cached = await redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }
  } catch (err) {
    console.error("Redis Read Recipes Cache Error:", err);
  }

  const filterQuery = {
    ...normalizedQuery,
    category: categoryUpper,
    status: FoodStatus.PUBLISHED,
  };

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

  const result = {
    meta: qb.getMeta(total),
    data,
  };

  try {
    await redis.set(cacheKey, JSON.stringify(result), "EX", 300);
  } catch (err) {
    console.error("Redis Write Recipes Cache Error:", err);
  }

  return result;
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
  getRecipeByCategory,
};
