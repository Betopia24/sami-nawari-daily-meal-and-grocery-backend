/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-inferrable-types */
import { FoodCategory, FoodStatus, ReviewStatus, SellerRequestStatus } from "@prisma/client";
import ApiError from "../../errors/apiError";
import { prisma } from "../../prisma/prisma";
import redis from "../../utils/redisClient";


const getNearbySellers = async (
  latitude: number | undefined,
  longitude: number | undefined,
  radius: number,
  page: number = 1,
  limit: number = 10
) => {
  if (latitude === undefined || longitude === undefined) {
    const sellers = await prisma.sellerProfile.findMany({
      where: { status: SellerRequestStatus.APPROVED },
      select: {
        id: true,
        userId: true,
        businessName: true,
        cuisineTypes: true,
        description: true,
        address: true,
        workingHours: true,
        pickupAvailable: true,
        deliveryAvailable: true,
        averageRating: true,
        reviewCount: true,
        user: {
          select: {
            name: true,
            profilePicture: true,
          },
        },
      },
      orderBy: [
        { averageRating: "desc" },
        { reviewCount: "desc" },
      ],
      skip: (page - 1) * limit,
      take: limit,
    });
    return sellers;
  }

  const pipeline = [
    {
      $geoNear: {
        near: {
          type: "Point",
          coordinates: [longitude, latitude],
        },
        distanceField: "distance",
        maxDistance: radius,
        spherical: true,
        query: { status: SellerRequestStatus.APPROVED },
      },
    },
    {
      $lookup: {
        from: "users",
        localField: "userId",
        foreignField: "_id",
        as: "user",
      },
    },
    {
      $unwind: {
        path: "$user",
        preserveNullAndEmptyArrays: true,
      },
    },
    {
      $addFields: {
        // Classify into 1km distance buckets (distance is in meters, divide by 1000)
        distanceBucket: { $floor: { $divide: ["$distance", 1000] } },
      },
    },
    {
      // First prioritize closer 1km buckets, then sort by highest averageRating, then by exact distance
      $sort: {
        distanceBucket: 1,
        averageRating: -1,
        distance: 1,
      },
    },
    {
      $project: {
        id: { $toString: "$_id" },
        userId: { $toString: "$userId" },
        businessName: 1,
        cuisineTypes: 1,
        description: 1,
        address: 1,
        workingHours: 1,
        pickupAvailable: 1,
        deliveryAvailable: 1,
        distance: 1,
        averageRating: 1,
        reviewCount: 1,
        user: {
          name: "$user.name",
          profilePicture: "$user.profilePicture",
        },
      },
    },
    { $skip: (page - 1) * limit },
    { $limit: limit },
  ];

  const sellers = await prisma.sellerProfile.aggregateRaw({
    pipeline,
  });

  return sellers;
};

  
const getSellerMenu = async (
  sellerId: string,
  category?: FoodCategory,
  page: number = 1,
  limit: number = 10
) => {
  const where: any = {
    sellerId,
    status: FoodStatus.PUBLISHED,
  };
  if (category) {
    where.category = category;
  }

  const [foods, total] = await Promise.all([
    prisma.food.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { createdAt: "desc" },
    }),
    prisma.food.count({ where }),
  ]);

  return {
    meta: {
      page,
      limit,
      total,
      totalPage: Math.ceil(total / limit),
    },
    data: foods,
  };
};


const getSellerAbout = async (
  sellerId: string,
  buyerUserId?: string
) => {
  const profile = await prisma.sellerProfile.findFirst({
    where: {
      OR: [
        { userId: sellerId },
        { id: sellerId },
      ],
    },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          profilePicture: true,
        },
      },
    },
  });

  if (!profile) {
    throw new ApiError(404, "Seller profile not found");
  }

  let isFavorite = false;
  if (buyerUserId) {
    const fav = await prisma.favoriteSeller.findUnique({
      where: {
        userId_sellerProfileId: {
          userId: buyerUserId,
          sellerProfileId: profile.id,
        },
      },
    });
    isFavorite = !!fav;
  }

  return {
    ...profile,
    isFavorite,
  };
};

const getSellerReviews = async (sellerId: string, page: number = 1, limit: number = 10) => {
  const sellerFoods = await prisma.food.findMany({
    where: { sellerId },
    select: { id: true },
  });
  const foodIds = sellerFoods.map((f) => f.id);

  const where = {
    foodId: { in: foodIds },
    status: ReviewStatus.PUBLISHED,
  };

  const [reviews, total] = await Promise.all([
    prisma.review.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            profilePicture: true,
          },
        },
        food: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.review.count({ where }),
  ]);

  return {
    meta: {
      page,
      limit,
      total,
      totalPage: Math.ceil(total / limit),
    },
    data: reviews,
  };
};

const getFoodDetails = async (foodId: string, userId?: string) => {
  const cacheKey = `food_details:${foodId}`;

  let food: any = null;


  try {
    const cached = await redis.get(cacheKey);
    if (cached) {
      food = JSON.parse(cached);
    }
  } catch (err) {
    console.error("Redis Read Explore Food Details Cache Error:", err);
  }

  if (!food) {
    food = await prisma.food.findUnique({
      where: { id: foodId },
      include: {
        seller: {
          select: {
            id: true,
            name: true,
            profilePicture: true,
            sellerProfile: {
              select: {
                businessName: true,
                averageRating: true,
                reviewCount: true,
              },
            },
          },
        },
      },
    });

    if (!food) {
      throw new ApiError(404, "Food item not found");
    }

    try {
      await redis.set(cacheKey, JSON.stringify(food), "EX", 600);
    } catch (err) {
      console.error("Redis Write Explore Food Details Cache Error:", err);
    }
  }

  let isBookmarked = false;
  if (userId) {
    const bookmark = await prisma.bookmark.findUnique({
      where: {
        userId_foodId: {
          userId,
          foodId,
        },
      },
    });
    isBookmarked = !!bookmark;
  }

  return {
    food,
    isBookmarked,
  };
};

export const ExploreService = {
  getNearbySellers,
  getSellerMenu,
  getSellerAbout,
  getSellerReviews,
  getFoodDetails,
};
