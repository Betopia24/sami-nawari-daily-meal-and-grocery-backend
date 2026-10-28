import { FoodStatus, SellerRequestStatus } from "@prisma/client";
import { prisma } from "../../prisma/prisma";
import ApiError from "../../errors/apiError";
import { AIService } from "../ai/ai.service";

const toggleBookmark = async (userId: string, foodId: string) => {
  const foodExists = await prisma.food.findUnique({
    where: { id: foodId },
  });

  if (!foodExists) {
    throw new ApiError(404, "Food item not found");
  }

  const existingBookmark = await prisma.bookmark.findUnique({
    where: {
      userId_foodId: {
        userId,
        foodId,
      },
    },
  });

  if (existingBookmark) {
    await prisma.bookmark.delete({
      where: {
        userId_foodId: {
          userId,
          foodId,
        },
      },
    });
    return { bookmarked: false, message: "Bookmark removed successfully" };
  } else {
    await prisma.bookmark.create({
      data: {
        userId,
        foodId,
      },
    });
    return { bookmarked: true, message: "Bookmarked successfully" };
  }
};

const getMyBookmarks = async (userId: string) => {
  const bookmarks = await prisma.bookmark.findMany({
    where: { userId },
    include: {
      food: {
        include: {
          seller: {
            select: {
              id: true,
              name: true,
              profilePicture: true,
              sellerProfile: {
                select: {
                  businessName: true,
                },
              },
            },
          },
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  return bookmarks.map((b) => b.food);
};

// Calculate distance in km using Haversine formula
const calculateDistanceKm = (
  lat1?: number | null,
  lon1?: number | null,
  lat2?: number | null,
  lon2?: number | null
): number | null => {
  if (
    lat1 === undefined || lat1 === null ||
    lon1 === undefined || lon1 === null ||
    lat2 === undefined || lat2 === null ||
    lon2 === undefined || lon2 === null
  ) {
    return null;
  }
  const toRad = (val: number) => (val * Math.PI) / 180;
  const R = 6371; // Earth's radius in km
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Number((R * c).toFixed(1));
};

const checkIsSellerOpen = (workingHours: any): boolean => {
  if (!workingHours || typeof workingHours !== "object") return true;
  const days = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
  const todayKey = days[new Date().getDay()];
  const schedule = workingHours[todayKey] || workingHours[todayKey.charAt(0).toUpperCase() + todayKey.slice(1)];
  if (!schedule) return true;
  if (typeof schedule.isOpen === "boolean") {
    return schedule.isOpen;
  }
  return true;
};

const toggleFavoriteSeller = async (userId: string, sellerIdentifier: string) => {
  if (!sellerIdentifier) {
    throw new ApiError(400, "sellerId is required");
  }

  // Accept either SellerProfile.id or Seller User.id
  let sellerProfile = await prisma.sellerProfile.findFirst({
    where: {
      OR: [
        { id: sellerIdentifier },
        { userId: sellerIdentifier },
      ],
    },
  });

  if (!sellerProfile) {
    throw new ApiError(404, "Seller profile not found");
  }

  const existingFavorite = await prisma.favoriteSeller.findUnique({
    where: {
      userId_sellerProfileId: {
        userId,
        sellerProfileId: sellerProfile.id,
      },
    },
  });

  if (existingFavorite) {
    await prisma.favoriteSeller.delete({
      where: {
        userId_sellerProfileId: {
          userId,
          sellerProfileId: sellerProfile.id,
        },
      },
    });
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { profileVersion: { increment: 1 } },
    });
    void AIService.invalidateUserProfileCache(userId, updatedUser.profileVersion || 1);
    return {
      isFavorite: false,
      sellerProfileId: sellerProfile.id,
      sellerUserId: sellerProfile.userId,
      message: "Seller removed from favorites successfully",
    };
  } else {
    await prisma.favoriteSeller.create({
      data: {
        userId,
        sellerProfileId: sellerProfile.id,
      },
    });
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { profileVersion: { increment: 1 } },
    });
    void AIService.invalidateUserProfileCache(userId, updatedUser.profileVersion || 1);
    return {
      isFavorite: true,
      sellerProfileId: sellerProfile.id,
      sellerUserId: sellerProfile.userId,
      message: "Seller added to favorites successfully",
    };
  }
};

const getMyFavoriteSellers = async (userId: string, query: Record<string, any> = {}) => {
  const buyerLat = query.latitude !== undefined ? Number(query.latitude) : undefined;
  const buyerLon = query.longitude !== undefined ? Number(query.longitude) : undefined;

  const favorites = await prisma.favoriteSeller.findMany({
    where: { userId },
    include: {
      sellerProfile: {
        include: {
          user: {
            select: {
              id: true,
              name: true,
              profilePicture: true,
              foods: {
                where: { status: FoodStatus.PUBLISHED },
                orderBy: { createdAt: "desc" },
                take: 1,
                select: {
                  id: true,
                  name: true,
                  description: true,
                  images: true,
                  price: true,
                  preparationTime: true,
                  deliveryFee: true,
                },
              },
            },
          },
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  const sellers = favorites
    .filter((fav) => fav.sellerProfile && fav.sellerProfile.status === SellerRequestStatus.APPROVED)
    .map((fav) => {
      const sp = fav.sellerProfile;
      const featuredFood = sp.user?.foods?.[0] || null;
      const distanceKm = calculateDistanceKm(buyerLat, buyerLon, sp.latitude, sp.longitude);
      const isOpen = checkIsSellerOpen(sp.workingHours);

      return {
        id: sp.id,
        sellerId: sp.userId,
        userId: sp.userId,
        businessName: sp.businessName,
        ownerName: sp.ownerName || sp.user?.name,
        profilePicture: sp.user?.profilePicture || null,
        coverImage: featuredFood?.images?.[0] || sp.kitchenImages?.[0] || sp.user?.profilePicture || null,
        kitchenImages: sp.kitchenImages,
        cuisineTypes: sp.cuisineTypes,
        description: sp.description,
        featuredDishSnippet: featuredFood
          ? `"${featuredFood.name}" — ${featuredFood.description}`
          : sp.description,
        featuredFood,
        preparationTime: featuredFood?.preparationTime || "25 min",
        deliveryFee: featuredFood?.deliveryFee ?? 0,
        address: sp.address,
        latitude: sp.latitude,
        longitude: sp.longitude,
        distanceKm,
        distanceLabel: distanceKm !== null ? `${distanceKm} km` : null,
        averageRating: sp.averageRating,
        reviewCount: sp.reviewCount,
        pickupAvailable: sp.pickupAvailable,
        deliveryAvailable: sp.deliveryAvailable,
        workingHours: sp.workingHours,
        isOpen,
        isFavorite: true,
        favoritedAt: fav.createdAt,
      };
    });

  return {
    totalSaved: sellers.length,
    savedLabel: `${sellers.length} saved`,
    sellers,
  };
};

export const BookmarkService = {
  toggleBookmark,
  getMyBookmarks,
  toggleFavoriteSeller,
  getMyFavoriteSellers,
};
