/* eslint-disable @typescript-eslint/no-explicit-any */
import { SellerRequestStatus, UserRole } from "@prisma/client";
import ApiError from "../../errors/apiError";
import { prisma } from "../../prisma/prisma";
import { PrismaQueryBuilder } from "../../utils/QueryBuilder";
import emailSender from "../../utils/emailSender";
import { getSellerStatusEmailTemplate } from "../../utils/emailTemplates";
import {
  TApproveRejectSellerPayload,
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


  if (user.sellerProfile) {
    const updated = await prisma.sellerProfile.update({
      where: { userId },
      data: {
        ...payload,
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

    return tx.sellerProfile.update({
      where: { userId },
      data: sellerProfileData,
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
  const qb = new PrismaQueryBuilder(query)
    .filter()
    .search(["businessName", "ownerName", "phone"])
    .sort()
    .paginate();

  const prismaQuery = qb.build();

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

  return updatedProfile;
};

export const SellerService = {
  submitSellerRequest,
  getMySellerProfile,
  updateSellerProfile,
  getAllSellerRequests,
  getSellerRequestById,
  approveOrRejectSellerRequest,
};
