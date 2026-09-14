/* eslint-disable @typescript-eslint/no-explicit-any */
import { NotificationType, SellerRequestStatus, UserRole } from "@prisma/client";
import ApiError from "../../errors/apiError";
import { prisma } from "../../prisma/prisma";
import { NotificationService } from "../notification/notification.service";
import { PrismaQueryBuilder } from "../../utils/QueryBuilder";
import emailSender from "../../utils/emailSender";
import { getSellerStatusEmailTemplate } from "../../utils/emailTemplates";
import {
  TApproveRejectSellerPayload,
  TChangeSellerStatusPayload,
  TSubmitSellerRequestPayload,
  TUpdateSellerProfilePayload,
} from "./seller.interface";


const submitSellerRequest = async (
  userId: string,
  payload: TSubmitSellerRequestPayload
) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { sellerProfile: true },
  });

  if (!user) {
    throw new ApiError(404, "User not found");
  }


  if (user.sellerProfile?.status === SellerRequestStatus.APPROVED) {
    throw new ApiError(400, "You are already an approved seller.");
  }


  const location = payload.longitude !== undefined && payload.latitude !== undefined
    ? { type: "Point", coordinates: [payload.longitude, payload.latitude] }
    : undefined;

  if (user.sellerProfile) {
    const updated = await prisma.sellerProfile.update({
      where: { userId },
      data: {
        ...payload,
        ...(location && { location }),
        status: SellerRequestStatus.PENDING,
        adminNote: null,
      },
    });
    return updated;
  }

  // Otherwise create a new seller profile request
  const sellerProfile = await prisma.sellerProfile.create({
    data: {
      userId,
      ...payload,
      ...(location && { location }),
      cuisineTypes: payload.cuisineTypes ?? [],
      workingHours: payload.workingHours ?? {},
      pickupAvailable: payload.pickupAvailable ?? false,
      deliveryAvailable: payload.deliveryAvailable ?? false,
    },
  });

  return sellerProfile;
};


const getMySellerProfile = async (userId: string) => {
  const profile = await prisma.sellerProfile.findUnique({
    where: { userId },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          isSeller: true,
          profilePicture: true,
        },
      },
    },
  });

  if (!profile) {
    throw new ApiError(404, "Seller profile not found. Please submit a seller request first.");
  }

  return profile;
};


const updateSellerProfile = async (
  userId: string,
  payload: TUpdateSellerProfilePayload
) => {
  const profile = await prisma.sellerProfile.findUnique({
    where: { userId },
  });

  if (!profile) {
    throw new ApiError(404, "Seller profile not found.");
  }

  if (profile.status !== SellerRequestStatus.APPROVED) {
    throw new ApiError(403, "Only approved sellers can update their profile.");
  }

  const { profilePicture, ...sellerProfileData } = payload;

  const updated = await prisma.$transaction(async (tx) => {
    if (profilePicture !== undefined) {
      await tx.user.update({
        where: { id: userId },
        data: { profilePicture },
      });
    }

    const location = sellerProfileData.longitude !== undefined && sellerProfileData.latitude !== undefined
      ? { type: "Point", coordinates: [sellerProfileData.longitude, sellerProfileData.latitude] }
      : undefined;

    return tx.sellerProfile.update({
      where: { userId },
      data: {
        ...sellerProfileData,
        ...(location && { location }),
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            isSeller: true,
            profilePicture: true,
          },
        },
      },
    });
  });

  return updated;
};


const getAllSellerRequests = async (query: Record<string, any>) => {
  const { searchTerm, ...restQuery } = query;

  const qb = new PrismaQueryBuilder(restQuery)
    .filter()
    .sort()
    .paginate();

  const prismaQuery = qb.build();

  // Only return requests with PENDING status
  prismaQuery.where = {
    ...prismaQuery.where,
    status: SellerRequestStatus.PENDING,
  };

  if (searchTerm) {
    prismaQuery.where = {
      ...prismaQuery.where,
      OR: [
        { businessName: { contains: searchTerm, mode: "insensitive" } },
        { ownerName: { contains: searchTerm, mode: "insensitive" } },
        { phone: { contains: searchTerm, mode: "insensitive" } },
        {
          user: {
            OR: [
              { name: { contains: searchTerm, mode: "insensitive" } },
              { email: { contains: searchTerm, mode: "insensitive" } },
            ],
          },
        },
      ],
    };
  }

  const [data, total] = await Promise.all([
    prisma.sellerProfile.findMany({
      where: prismaQuery.where,
      orderBy: prismaQuery.orderBy,
      skip: prismaQuery.skip,
      take: prismaQuery.take,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            isSeller: true,
            status: true,
            profilePicture: true,
          },
        },
      },
    }),
    prisma.sellerProfile.count({ where: prismaQuery.where }),
  ]);

  return {
    meta: qb.getMeta(total),
    data,
  };
};


const getAllSellers = async (query: Record<string, any>) => {
  const { searchTerm, status, ...restQuery } = query;

  const qb = new PrismaQueryBuilder(restQuery)
    .filter()
    .sort()
    .paginate();

  const prismaQuery = qb.build();

  // Custom status filtering
  if (status) {
    if (status === "SUSPENDED") {
      prismaQuery.where = {
        ...prismaQuery.where,
        user: {
          status: "SUSPENDED",
        },
      };
    } else if (status === "APPROVED") {
      prismaQuery.where = {
        ...prismaQuery.where,
        status: "APPROVED",
        user: {
          status: {
            not: "SUSPENDED",
          },
        },
      };
    } else {
      prismaQuery.where = {
        ...prismaQuery.where,
        status: status,
      };
    }
  }

  // Custom nested searching (businessName, ownerName, phone, user.name, user.email)
  if (searchTerm) {
    prismaQuery.where = {
      ...prismaQuery.where,
      OR: [
        { businessName: { contains: searchTerm, mode: "insensitive" } },
        { ownerName: { contains: searchTerm, mode: "insensitive" } },
        { phone: { contains: searchTerm, mode: "insensitive" } },
        {
          user: {
            OR: [
              { name: { contains: searchTerm, mode: "insensitive" } },
              { email: { contains: searchTerm, mode: "insensitive" } },
            ],
          },
        },
      ],
    };
  }

  const [sellers, total] = await Promise.all([
    prisma.sellerProfile.findMany({
      where: prismaQuery.where,
      orderBy: prismaQuery.orderBy,
      skip: prismaQuery.skip,
      take: prismaQuery.take,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            isSeller: true,
            status: true,
            profilePicture: true,
          },
        },
      },
    }),
    prisma.sellerProfile.count({ where: prismaQuery.where }),
  ]);

  const sellerUserIds = sellers.map((s) => s.userId);

  const [foodCountsGroup, rawOrderCounts] = await Promise.all([
    prisma.food.groupBy({
      by: ["sellerId"],
      where: {
        sellerId: { in: sellerUserIds },
      },
      _count: {
        _all: true,
      },
    }),
    prisma.order.aggregateRaw({
      pipeline: [
        {
          $match: {
            parentId: { $ne: null },
            "items.sellerId": { $in: sellerUserIds.map((id) => ({ $oid: id })) },
          },
        },
        {
          $unwind: "$items",
        },
        {
          $match: {
            "items.sellerId": { $in: sellerUserIds.map((id) => ({ $oid: id })) },
          },
        },
        {
          $group: {
            _id: "$items.sellerId",
            uniqueOrders: { $addToSet: "$_id" },
          },
        },
        {
          $project: {
            _id: 0,
            sellerId: { $toString: "$_id" },
            count: { $size: "$uniqueOrders" },
          },
        },
      ],
    }),
  ]);

  const foodCountMap = new Map<string, number>();
  foodCountsGroup.forEach((item) => {
    foodCountMap.set(item.sellerId, item._count._all);
  });

  const orderCountMap = new Map<string, number>();
  if (Array.isArray(rawOrderCounts)) {
    rawOrderCounts.forEach((item: any) => {
      if (item && item.sellerId) {
        let count = 0;
        if (typeof item.count === "number") {
          count = item.count;
        } else if (item.count && typeof item.count === "object" && "$numberInt" in item.count) {
          count = parseInt(item.count.$numberInt, 10) || 0;
        }
        orderCountMap.set(item.sellerId, count);
      }
    });
  }

  const data = sellers.map((seller) => {
    return {
      ...seller,
      totalFoods: foodCountMap.get(seller.userId) || 0,
      totalOrders: orderCountMap.get(seller.userId) || 0,
    };
  });

  return {
    meta: qb.getMeta(total),
    data,
  };
};


const getSellerRequestById = async (id: string) => {
  const profile = await prisma.sellerProfile.findUnique({
    where: { id },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          profilePicture: true,
          isSeller: true,
          role: true,
        },
      },
    },
  });

  if (!profile) {
    throw new ApiError(404, "Seller request not found.");
  }

  return profile;
};


const approveOrRejectSellerRequest = async (
  profileId: string,
  payload: TApproveRejectSellerPayload
) => {
  const profile = await prisma.sellerProfile.findUnique({
    where: { id: profileId },
    include: { user: true },
  });

  if (!profile) {
    throw new ApiError(404, "Seller request not found.");
  }

  if (profile.status === SellerRequestStatus.APPROVED) {
    throw new ApiError(400, "This seller request has already been approved.");
  }

  // Update the seller profile status
  const updatedProfile = await prisma.sellerProfile.update({
    where: { id: profileId },
    data: {
      status: payload.status,
      adminNote: payload.adminNote ?? null,
    },
  });

  // Update the associated user based on decision
  if (payload.status === SellerRequestStatus.APPROVED) {
    await prisma.user.update({
      where: { id: profile.userId },
      data: {
        isSeller: true,
        role: UserRole.SELLER,
      },
    });
  } else if (payload.status === SellerRequestStatus.REJECTED) {
    await prisma.user.update({
      where: { id: profile.userId },
      data: {
        isSeller: false,
        role: UserRole.BUYER,
      },
    });
  }

  // Send status update email notification to the user asynchronously
  if (profile.user?.email) {
    const subject = payload.status === SellerRequestStatus.APPROVED
      ? "Sami Nawari — Seller Account Approved! 🎉"
      : "Sami Nawari — Seller Account Application Status ❌";

    const htmlContent = getSellerStatusEmailTemplate(
      profile.user.name,
      profile.businessName,
      payload.status,
      payload.adminNote
    );

    // Run in background, don't block request response
    emailSender(subject, profile.user.email, htmlContent).catch((err) => {
      console.error(`Failed to send seller status email to ${profile.user.email}:`, err);
    });
  }

  // Create in-app and push notification for the user asynchronously
  NotificationService.createNotification({
    userId: profile.userId,
    title:
      payload.status === SellerRequestStatus.APPROVED
        ? "Seller Account Approved! 🎉"
        : "Seller Account Application Rejected ❌",
    message:
      payload.status === SellerRequestStatus.APPROVED
        ? `Congratulations! Your seller application for "${profile.businessName}" has been approved.`
        : `Your seller application for "${profile.businessName}" was rejected.${payload.adminNote ? ` Reason: ${payload.adminNote}` : ""}`,
    type: NotificationType.MARKETPLACE,
  }).catch((err) => {
    console.error(`Failed to send in-app notification for seller status to ${profile.userId}:`, err);
  });

  return updatedProfile;
};


const changeSellerStatus = async (
  sellerId: string,
  payload: TChangeSellerStatusPayload
) => {
  const profile = await prisma.sellerProfile.findFirst({
    where: {
      OR: [{ id: sellerId }, { userId: sellerId }],
    },
    include: { user: true },
  });

  if (!profile) {
    throw new ApiError(404, "Seller profile not found.");
  }

  // Update seller profile status
  const updatedProfile = await prisma.sellerProfile.update({
    where: { id: profile.id },
    data: {
      status: payload.status,
      ...(payload.adminNote ? { adminNote: payload.adminNote } : {}),
    },
  });

  // Sync user role and isSeller flag according to seller status
  if (payload.status === SellerRequestStatus.APPROVED) {
    await prisma.user.update({
      where: { id: profile.userId },
      data: {
        isSeller: true,
        role: UserRole.SELLER,
      },
    });
  } else if (
    payload.status === SellerRequestStatus.REJECTED ||
    payload.status === SellerRequestStatus.SUSPENDED
  ) {
    await prisma.user.update({
      where: { id: profile.userId },
      data: {
        isSeller: false,
        ...(profile.user.role === UserRole.SELLER ? { role: UserRole.BUYER } : {}),
      },
    });
  }

  // Send status update email notification to the user asynchronously
  if (profile.user?.email) {
    const subject =
      payload.status === SellerRequestStatus.APPROVED
        ? "Sami Nawari — Seller Account Approved! 🎉"
        : payload.status === SellerRequestStatus.SUSPENDED
        ? "Sami Nawari — Seller Account Suspended ⚠️"
        : "Sami Nawari — Seller Account Application Status ❌";

    const emailStatus = payload.status === SellerRequestStatus.APPROVED ? "APPROVED" : "REJECTED";

    const htmlContent = getSellerStatusEmailTemplate(
      profile.user.name,
      profile.businessName,
      emailStatus,
      payload.adminNote ?? profile.adminNote
    );

    emailSender(subject, profile.user.email, htmlContent).catch((err) => {
      console.error(`Failed to send seller status email to ${profile.user.email}:`, err);
    });
  }

  // Create in-app notification
  NotificationService.createNotification({
    userId: profile.userId,
    title:
      payload.status === SellerRequestStatus.APPROVED
        ? "Seller Account Approved! 🎉"
        : payload.status === SellerRequestStatus.SUSPENDED
        ? "Seller Account Suspended ⚠️"
        : "Seller Account Application Status Update ❌",
    message:
      payload.status === SellerRequestStatus.APPROVED
        ? `Congratulations! Your seller application for "${profile.businessName}" has been approved.`
        : payload.status === SellerRequestStatus.SUSPENDED
        ? `Your seller profile for "${profile.businessName}" has been suspended.${payload.adminNote ? ` Reason: ${payload.adminNote}` : ""}`
        : `Your seller application for "${profile.businessName}" was rejected.${payload.adminNote ? ` Reason: ${payload.adminNote}` : ""}`,
    type: NotificationType.MARKETPLACE,
  }).catch((err) => {
    console.error(`Failed to send in-app notification for seller status to ${profile.userId}:`, err);
  });

  return updatedProfile;
};

export const SellerService = {
  submitSellerRequest,
  getMySellerProfile,
  updateSellerProfile,
  getAllSellerRequests,
  getAllSellers,
  getSellerRequestById,
  approveOrRejectSellerRequest,
  changeSellerStatus,
};
