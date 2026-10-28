/* eslint-disable @typescript-eslint/no-explicit-any */
import { NotificationType, SellerRequestStatus, UserRole, OrderStatus, PaymentMethod } from "@prisma/client";
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
import { stripe } from "../../utils/stripe";
import config from "../../config";


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
      kitchenImages: payload.kitchenImages ?? [],
    },
  });

  return sellerProfile;
};


const getMySellerProfile = async (userId: string) => {
  const sellerWhereCondition = {
    parentId: { not: null },
    items: {
      some: {
        sellerId: userId,
      },
    },
  };

  const [profile, totalOrders, pendingOrders, completedOrders] = await Promise.all([
    prisma.sellerProfile.findUnique({
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
    }),
    prisma.order.count({
      where: sellerWhereCondition,
    }),
    prisma.order.count({
      where: {
        ...sellerWhereCondition,
        status: {
          in: [
            OrderStatus.CONFIRMED,
            OrderStatus.ACCEPTED,
            OrderStatus.PREPARING,
            OrderStatus.OUT_FOR_DELIVERY,
            OrderStatus.PENDING_PAYMENT,
          ],
        },
      },
    }),
    prisma.order.count({
      where: {
        ...sellerWhereCondition,
        status: {
          in: [OrderStatus.COMPLETED, OrderStatus.DELIVERED],
        },
      },
    }),
  ]);

  if (!profile) {
    throw new ApiError(404, "Seller profile not found. Please submit a seller request first.");
  }

  return {
    ...profile,
    stats: {
      orders: totalOrders,
      pending: pendingOrders,
      completed: completedOrders,
    },
    orders: totalOrders,
    pending: pendingOrders,
    completed: completedOrders,
  };
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

const createStripeConnectAccount = async (userId: string) => {
  const seller = await prisma.sellerProfile.findUnique({
    where: { userId },
    include: {
      user: {
        select: {
          email: true,
          name: true,
        },
      },
    },
  });

  if (!seller) {
    throw new ApiError(404, "Seller profile not found");
  }

  let stripeAccountId = seller.stripeAccountId;

  // If no Stripe Connect account exists, create one
  if (!stripeAccountId) {
    const account = await stripe.accounts.create({
      type: "express",
      country: "US", // Default country, can be set based on seller location
      email: seller.user.email,
      capabilities: {
        card_payments: { requested: true },
        transfers: { requested: true },
      },
      business_type: "individual",
      business_profile: {
        name: seller.businessName,
        url: config.stripe.frontendUrl || "https://saminawari.com",
      },
    });

    stripeAccountId = account.id;

    await prisma.sellerProfile.update({
      where: { userId },
      data: {
        stripeAccountId,
      },
    });
  }

  const frontendUrl = config.stripe.frontendUrl || config.clientUrl || "http://localhost:3000";

  // Generate onboarding link
  const accountLink = await stripe.accountLinks.create({
    account: stripeAccountId,
    refresh_url: `${frontendUrl}/seller/stripe-connect/refresh`,
    return_url: `${frontendUrl}/seller/stripe-connect/return`,
    type: "account_onboarding",
  });

  return {
    url: accountLink.url,
    stripeAccountId,
  };
};

const getStripeAccountStatus = async (userId: string) => {
  const seller = await prisma.sellerProfile.findUnique({
    where: { userId },
  });

  if (!seller) {
    throw new ApiError(404, "Seller profile not found");
  }

  if (!seller.stripeAccountId) {
    return {
      connected: false,
      stripeAccountId: null,
      chargesEnabled: false,
      payoutsEnabled: false,
      detailsSubmitted: false,
    };
  }

  const account = await stripe.accounts.retrieve(seller.stripeAccountId);

  const chargesEnabled = account.charges_enabled ?? false;
  const payoutsEnabled = account.payouts_enabled ?? false;
  const detailsSubmitted = account.details_submitted ?? false;

  await prisma.sellerProfile.update({
    where: { userId },
    data: {
      stripeChargesEnabled: chargesEnabled,
      stripePayoutsEnabled: payoutsEnabled,
      stripeOnboardingCompleted: detailsSubmitted,
    },
  });

  return {
    connected: true,
    stripeAccountId: seller.stripeAccountId,
    chargesEnabled,
    payoutsEnabled,
    detailsSubmitted,
  };
};

const createStripeDashboardLink = async (userId: string) => {
  const seller = await prisma.sellerProfile.findUnique({
    where: { userId },
  });

  if (!seller || !seller.stripeAccountId) {
    throw new ApiError(400, "Seller does not have a connected Stripe account");
  }

  const loginLink = await stripe.accounts.createLoginLink(seller.stripeAccountId);

  return {
    url: loginLink.url,
  };
};

const getPeriodDateRange = (period?: string, year?: number, month?: number) => {
  const now = new Date();
  let startDate: Date;
  let endDate: Date;
  let prevStartDate: Date;
  let prevEndDate: Date;

  if (year && month) {
    startDate = new Date(year, month - 1, 1);
    endDate = new Date(year, month, 0, 23, 59, 59, 999);
    prevStartDate = new Date(year, month - 2, 1);
    prevEndDate = new Date(year, month - 1, 0, 23, 59, 59, 999);
  } else if (period === "last_month") {
    startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    endDate = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
    prevStartDate = new Date(now.getFullYear(), now.getMonth() - 2, 1);
    prevEndDate = new Date(now.getFullYear(), now.getMonth() - 1, 0, 23, 59, 59, 999);
  } else if (period === "this_year") {
    startDate = new Date(now.getFullYear(), 0, 1);
    endDate = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);
    prevStartDate = new Date(now.getFullYear() - 1, 0, 1);
    prevEndDate = new Date(now.getFullYear() - 1, 11, 31, 23, 59, 59, 999);
  } else {
    // Default: this_month
    startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    prevStartDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    prevEndDate = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
  }

  return { startDate, endDate, prevStartDate, prevEndDate };
};

const getSellerEarningsOverview = async (userId: string, query: Record<string, any>) => {
  const seller = await prisma.sellerProfile.findUnique({
    where: { userId },
  });

  if (!seller) {
    throw new ApiError(404, "Seller profile not found");
  }

  const period = (query.period as string) || "this_month";
  const year = query.year ? Number(query.year) : undefined;
  const month = query.month ? Number(query.month) : undefined;

  const { startDate, endDate, prevStartDate, prevEndDate } = getPeriodDateRange(period, year, month);

  const baseSellerWhere = {
    parentId: { not: null },
    items: {
      some: {
        sellerId: userId,
      },
    },
  };

  const completedStatuses = [OrderStatus.COMPLETED, OrderStatus.DELIVERED];
  const pendingStatuses = [
    OrderStatus.CONFIRMED,
    OrderStatus.ACCEPTED,
    OrderStatus.PREPARING,
    OrderStatus.OUT_FOR_DELIVERY,
    OrderStatus.PENDING_PAYMENT,
  ];

  const [currentPeriodOrders, prevPeriodOrders, currentPendingOrders] = await Promise.all([
    prisma.order.findMany({
      where: {
        ...baseSellerWhere,
        status: { in: completedStatuses },
        ...(period === "all" ? {} : { createdAt: { gte: startDate, lte: endDate } }),
      },
      orderBy: { createdAt: "asc" },
    }),
    prisma.order.findMany({
      where: {
        ...baseSellerWhere,
        status: { in: completedStatuses },
        createdAt: { gte: prevStartDate, lte: prevEndDate },
      },
    }),
    prisma.order.findMany({
      where: {
        ...baseSellerWhere,
        status: { in: pendingStatuses },
      },
    }),
  ]);

  const calcOrderSellerTotal = (order: any) => {
    const sellerItems = order.items.filter((i: any) => i.sellerId === userId);
    const itemsTotal = sellerItems.reduce((sum: number, item: any) => sum + item.subtotal, 0);
    return Number((itemsTotal + (order.deliveryFee || 0)).toFixed(2));
  };

  const totalEarnings = Number(
    currentPeriodOrders.reduce((acc, order) => acc + calcOrderSellerTotal(order), 0).toFixed(2)
  );
  const prevTotalEarnings = Number(
    prevPeriodOrders.reduce((acc, order) => acc + calcOrderSellerTotal(order), 0).toFixed(2)
  );

  let earningsGrowthPercentage = 0;
  if (prevTotalEarnings > 0) {
    earningsGrowthPercentage = Number(
      (((totalEarnings - prevTotalEarnings) / prevTotalEarnings) * 100).toFixed(1)
    );
  } else if (totalEarnings > 0) {
    earningsGrowthPercentage = 100;
  }

  const completedOrdersCount = currentPeriodOrders.length;
  const prevCompletedOrdersCount = prevPeriodOrders.length;
  let ordersGrowthPercentage = 0;
  if (prevCompletedOrdersCount > 0) {
    ordersGrowthPercentage = Number(
      (((completedOrdersCount - prevCompletedOrdersCount) / prevCompletedOrdersCount) * 100).toFixed(1)
    );
  } else if (completedOrdersCount > 0) {
    ordersGrowthPercentage = 100;
  }

  const pendingOrdersCount = currentPendingOrders.length;
  const pendingEarnings = Number(
    currentPendingOrders.reduce((acc, order) => acc + calcOrderSellerTotal(order), 0).toFixed(2)
  );

  // Build chart data points across the period
  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const chartData: { label: string; date: string; earnings: number; cumulativeEarnings: number }[] = [];

  const targetMonth = startDate.getMonth();
  const targetYear = startDate.getFullYear();
  const daysInMonth = new Date(targetYear, targetMonth + 1, 0).getDate();
  const intervals = [1, 5, 10, 15, 20, 25, daysInMonth];
  const uniqueDays = [...new Set(intervals)];

  let runningCumulative = 0;
  let prevDay = 0;

  for (const day of uniqueDays) {
    const dayStart = new Date(targetYear, targetMonth, prevDay + 1, 0, 0, 0, 0);
    const dayEnd = new Date(targetYear, targetMonth, day, 23, 59, 59, 999);

    const bucketEarnings = currentPeriodOrders
      .filter((o) => o.createdAt >= dayStart && o.createdAt <= dayEnd)
      .reduce((acc, o) => acc + calcOrderSellerTotal(o), 0);

    runningCumulative = Number((runningCumulative + bucketEarnings).toFixed(2));

    chartData.push({
      label: `${monthNames[targetMonth]} ${day}`,
      date: dayEnd.toISOString().split("T")[0],
      earnings: Number(bucketEarnings.toFixed(2)),
      cumulativeEarnings: runningCumulative,
    });

    prevDay = day;
  }

  // Retrieve live Stripe available balance if seller has a connected Stripe account
  let availableBalance = totalEarnings;
  let stripePendingBalance = pendingEarnings;

  if (seller.stripeAccountId) {
    try {
      const balance = await stripe.balance.retrieve({
        stripeAccount: seller.stripeAccountId,
      });
      const avail = balance.available.reduce((acc, b) => acc + b.amount, 0) / 100;
      const pend = balance.pending.reduce((acc, b) => acc + b.amount, 0) / 100;
      availableBalance = Number(avail.toFixed(2));
      stripePendingBalance = Number(pend.toFixed(2));
    } catch {
      // Fallback to calculated order totals if Stripe balance retrieval fails
    }
  }

  return {
    period,
    totalEarnings,
    earningsGrowthPercentage,
    completedOrders: {
      count: completedOrdersCount,
      growthPercentage: ordersGrowthPercentage,
    },
    pendingEarnings: {
      amount: pendingEarnings,
      ordersCount: pendingOrdersCount,
      stripePendingBalance,
    },
    availableBalance: {
      amount: availableBalance,
      readyForWithdraw: availableBalance > 0 && seller.stripePayoutsEnabled,
    },
    chartData,
  };
};

const getSellerEarningsHistory = async (userId: string, query: Record<string, any>) => {
  const seller = await prisma.sellerProfile.findUnique({
    where: { userId },
  });

  if (!seller) {
    throw new ApiError(404, "Seller profile not found");
  }

  const page = Number(query.page) || 1;
  const limit = Number(query.limit) || 20;
  const skip = (page - 1) * limit;
  const period = (query.period as string) || "this_month";
  const year = query.year ? Number(query.year) : undefined;
  const month = query.month ? Number(query.month) : undefined;

  const { startDate, endDate } = getPeriodDateRange(period, year, month);

  const whereCondition: any = {
    parentId: { not: null },
    items: {
      some: {
        sellerId: userId,
      },
    },
    status: {
      in: [OrderStatus.COMPLETED, OrderStatus.DELIVERED],
    },
  };

  if (period !== "all") {
    whereCondition.createdAt = {
      gte: startDate,
      lte: endDate,
    };
  }

  if (query.paymentMethod) {
    whereCondition.paymentMethod = query.paymentMethod as PaymentMethod;
  }

  const [orders, total] = await Promise.all([
    prisma.order.findMany({
      where: whereCondition,
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    }),
    prisma.order.count({ where: whereCondition }),
  ]);

  const monthNamesFull = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  const transactions = orders.map((order) => {
    const sellerItems = order.items.filter((i) => i.sellerId === userId);
    const itemsTotal = sellerItems.reduce((sum, item) => sum + item.subtotal, 0);
    const amount = Number((itemsTotal + (order.deliveryFee || 0)).toFixed(2));

    let paymentLabel = "Cash on Delivery";
    if (order.paymentMethod === PaymentMethod.ONLINE) {
      paymentLabel = "Online Paid";
    }

    const d = new Date(order.createdAt);
    const monthGroup = `${monthNamesFull[d.getMonth()]} ${d.getFullYear()}`;

    return {
      id: order.id,
      orderNumber: `#${order.orderNumber}`,
      rawOrderNumber: order.orderNumber,
      amount,
      formattedAmount: `+ $${amount.toFixed(2)}`,
      paymentMethod: order.paymentMethod,
      paymentStatus: order.paymentStatus,
      paymentLabel,
      status: order.status,
      monthGroup,
      createdAt: order.createdAt,
    };
  });

  // Group by monthGroup for easy UI rendering (e.g. "August 2026")
  const groupedByMonth: Record<string, typeof transactions> = {};
  for (const tx of transactions) {
    if (!groupedByMonth[tx.monthGroup]) {
      groupedByMonth[tx.monthGroup] = [];
    }
    groupedByMonth[tx.monthGroup].push(tx);
  }

  return {
    meta: {
      page,
      limit,
      total,
      totalPage: Math.ceil(total / limit),
    },
    transactions,
    groupedByMonth,
  };
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
  createStripeConnectAccount,
  getStripeAccountStatus,
  createStripeDashboardLink,
  getSellerEarningsOverview,
  getSellerEarningsHistory,
};
