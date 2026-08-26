import { prisma } from "../../prisma/prisma";
import ApiError from "../../errors/apiError";

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

export const BookmarkService = {
  toggleBookmark,
  getMyBookmarks,
};
