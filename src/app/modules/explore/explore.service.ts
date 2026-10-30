/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-inferrable-types */
import { CuisineType, FoodCategory, FoodStatus, ReviewStatus, SellerRequestStatus } from "@prisma/client";
import ApiError from "../../errors/apiError";
import { prisma } from "../../prisma/prisma";
import redis from "../../utils/redisClient";

interface IGetNearbySellersParams {
  searchTerm?: string;
  cuisine?: CuisineType;
  deliveryAvailable?: boolean;
  pickupAvailable?: boolean;
  latitude?: number;
  longitude?: number;
  radius: number;
  page?: number;
  limit?: number;
}

const getNearbySellers = async (params: IGetNearbySellersParams) => {
  const {
    searchTerm,
    cuisine,
    deliveryAvailable,
    pickupAvailable,
    latitude,
    longitude,
    radius,
    page = 1,
    limit = 10,
  } = params;

  // Build Prisma Where Clause for fallback / regular search
  const whereClause: any = {
    status: SellerRequestStatus.APPROVED,
  };

  if (deliveryAvailable !== undefined) {
    whereClause.deliveryAvailable = deliveryAvailable;
  }
  if (pickupAvailable !== undefined) {
    whereClause.pickupAvailable = pickupAvailable;
  }
  if (cuisine) {
    whereClause.cuisineTypes = {
      has: cuisine,
    };
  }

  if (searchTerm && searchTerm.trim() !== "") {
    const trimmed = searchTerm.trim();
    whereClause.OR = [
      { businessName: { contains: trimmed, mode: "insensitive" } },
      { ownerName: { contains: trimmed, mode: "insensitive" } },
      { description: { contains: trimmed, mode: "insensitive" } },
      { address: { contains: trimmed, mode: "insensitive" } },
      {
        user: {
          OR: [
            { name: { contains: trimmed, mode: "insensitive" } },
            // Search inside seller's published foods
            {
              foods: {
                some: {
                  name: { contains: trimmed, mode: "insensitive" },
                  status: FoodStatus.PUBLISHED,
                },
              },
            },
          ],
        },
      },
    ];
  }

  // If no coordinates provided, use Prisma search
  if (latitude === undefined || longitude === undefined) {
    const sellers = await prisma.sellerProfile.findMany({
      where: whereClause,
      select: {
        id: true,
        userId: true,
        businessName: true,
        ownerName: true,
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

  // When coordinates are provided, use Mongo aggregation with geoNear + filters
  const geoQuery: any = {
    status: SellerRequestStatus.APPROVED,
  };
  if (deliveryAvailable !== undefined) {
    geoQuery.deliveryAvailable = deliveryAvailable;
  }
  if (pickupAvailable !== undefined) {
    geoQuery.pickupAvailable = pickupAvailable;
  }
  if (cuisine) {
    geoQuery.cuisineTypes = cuisine;
  }

  const pipeline: any[] = [
    {
      $geoNear: {
        near: {
          type: "Point",
          coordinates: [longitude, latitude],
        },
        distanceField: "distance",
        maxDistance: radius,
        spherical: true,
        query: geoQuery,
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
      $lookup: {
        from: "foods",
        localField: "userId",
        foreignField: "sellerId",
        as: "sellerFoods",
      },
    },
  ];

  // If search term is provided in location query, filter via $match
  if (searchTerm && searchTerm.trim() !== "") {
    const regex = { $regex: searchTerm.trim(), $options: "i" };
    pipeline.push({
      $match: {
        $or: [
          { businessName: regex },
          { ownerName: regex },
          { description: regex },
          { address: regex },
          { "user.name": regex },
          {
            sellerFoods: {
              $elemMatch: {
                name: regex,
                status: FoodStatus.PUBLISHED,
              },
            },
          },
        ],
      },
    });
  }

  pipeline.push(
    {
      $addFields: {
        distanceBucket: { $floor: { $divide: ["$distance", 1000] } },
      },
    },
    {
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
        ownerName: 1,
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
    { $limit: limit }
  );

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
