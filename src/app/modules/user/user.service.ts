/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
import bcrypt from "bcryptjs";
import { Request } from "express";
import ApiError from "../../errors/apiError";
import { prisma } from "../../prisma/prisma";
import { PrismaQueryBuilder } from "../../utils/QueryBuilder";
import { UserRole, UserStatus, SellerRequestStatus } from "@prisma/client";
import config from "../../config";
import { jwtHelper } from "../../utils/JwtHelper";
import {
  TUpdateProfilePayload,
  TUpdatePasswordPayload,
  TUpdateLanguageRegionPayload,
  TUpdateDietaryPreferencesPayload,
  TUpdateAllergiesPayload,
  TChangeUserStatusPayload
} from "./user.interface";

const createUser = async (req: Request) => {
  const { password, name, email, role, phone, username, isSeller, dietaryPreferences, allergies } = req.body;

  const isExistingUser = await prisma.user.findUnique({
    where: {
      email,
    },
  });

  if (isExistingUser) {
    throw new ApiError(409, "User already exists!");
  }

  if (!password) {
    throw new ApiError(400, "password is required");
  }

  const hashPassword = await bcrypt.hash(password, 10);

  // Generate or verify username
  let finalUsername = username;
  if (!finalUsername) {
    let baseUsername = name.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (!baseUsername) {
      baseUsername = 'user';
    }
    let isUsernameUnique = false;
    let counter = 0;
    finalUsername = baseUsername;

    while (!isUsernameUnique) {
      const existingUsername = await prisma.user.findUnique({
        where: {
          username: finalUsername,
        },
      });
      if (!existingUsername) {
        isUsernameUnique = true;
      } else {
        counter++;
        finalUsername = `${baseUsername}${counter}`;
      }
    }
  } else {
    const existingUsername = await prisma.user.findUnique({
      where: {
        username: finalUsername,
      },
    });
    if (existingUsername) {
      throw new ApiError(409, "Username already taken!");
    }
  }

  const result = await prisma.user.create({
    data: {
      name,
      email,
      password: hashPassword,
      role: role ?? UserRole.BUYER,
      phone,
      username: finalUsername,
      isSeller: isSeller ?? false,
      dietaryPreferences: dietaryPreferences ?? [],
      allergies: allergies ?? [],
      profilePicture: req.body.profilePicture ?? "https://i.ibb.co.com/q2gwGfV/356306451-54b19ada-d53e-4ee9-8882-9dfed1bf1396.jpg",
    },
  });

  const { password: _, ...userWithoutPassword } = result;
  return userWithoutPassword;
};


const findUserById = async (id: string) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        profilePicture: true,
        createdAt: true,
        updatedAt: true
      }
    });
    if (!user) {
      throw new ApiError(404, "User not found");
    }

    return user;
  } catch (error) {
    throw new ApiError(500, `Error finding user: ${error}`);
  }
};


const getAllUsers = async (query: Record<string, any>) => {
  // Normalize enum query parameters to uppercase to prevent case-sensitive mismatches with Prisma
  const normalizedQuery = { ...query };
  let isPendingStatus = false;

  if (normalizedQuery.status && typeof normalizedQuery.status === "string") {
    const statusUpper = normalizedQuery.status.toUpperCase();
    if (statusUpper === SellerRequestStatus.PENDING) {
      isPendingStatus = true;
      delete normalizedQuery.status;
    } else {
      if (!Object.values(UserStatus).includes(statusUpper as any)) {
        throw new ApiError(
          400,
          `Invalid status value. Expected one of: ${Object.values(UserStatus).join(", ")}, or ${SellerRequestStatus.PENDING}`
        );
      }
      normalizedQuery.status = statusUpper;
    }
  }

  if (normalizedQuery.role && typeof normalizedQuery.role === "string") {
    const roleUpper = normalizedQuery.role.toUpperCase();
    if (!Object.values(UserRole).includes(roleUpper as any)) {
      throw new ApiError(400, `Invalid role value. Expected one of: ${Object.values(UserRole).join(", ")}`);
    }
    normalizedQuery.role = roleUpper;
  }

  const qb = new PrismaQueryBuilder(normalizedQuery)
    .filter()
    .search(["name", "email"])
    .sort()
    .fields()
    .paginate();

  const prismaQuery = qb.build();

  if (isPendingStatus) {
    prismaQuery.where = {
      ...prismaQuery.where,
      sellerProfile: {
        status: SellerRequestStatus.PENDING,
      },
    };
  }

  const [data, total] = await Promise.all([
    prisma.user.findMany({
      ...prismaQuery,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        status: true,
        profilePicture: true,
        createdAt: true,
        updatedAt: true,
        sellerProfile: {
          select: {
            status: true,
          },
        },
        _count: {
          select: {
            orders: true,
          },
        },
      },
    }),
    prisma.user.count({ where: prismaQuery.where }),
  ]);

  const mappedData = data.map((user) => {
    let status = user.status as string;
    if (user.sellerProfile?.status === SellerRequestStatus.PENDING) {
      status = "PENDING";
    }
    const { sellerProfile, ...rest } = user;
    return {
      ...rest,
      status,
      ordersCount: user._count?.orders ?? 0,
    };
  });

  return {
    meta: qb.getMeta(total),
    data: mappedData,
  };
};



const getSingleUser = async (userId: string) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });
  if (!user) return null;
  const { password: _, ...userWithoutPassword } = user;
  return userWithoutPassword;
};

const userUpdateProfile = async (userId: string, payload: TUpdateProfilePayload) => {
  const {
    name,
    phone,
    username,
    bio,
    profilePicture,
    birthday,
    gender,
    address,
    isSeller,
    dietaryPreferences,
    allergies,
  } = payload;

  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    throw new ApiError(404, "User not found");
  }

  const updateData: any = {};

  if (name !== undefined) updateData.name = name;
  if (phone !== undefined) updateData.phone = phone;
  if (bio !== undefined) updateData.bio = bio;
  if (profilePicture !== undefined) updateData.profilePicture = profilePicture;
  if (birthday !== undefined) updateData.birthday = birthday;
  if (gender !== undefined) updateData.gender = gender;
  if (address !== undefined) updateData.address = address;
  if (isSeller !== undefined) updateData.isSeller = isSeller;
  if (dietaryPreferences !== undefined) updateData.dietaryPreferences = dietaryPreferences;
  if (allergies !== undefined) updateData.allergies = allergies;

  if (username !== undefined && username !== user.username) {
    const existingUsername = await prisma.user.findUnique({
      where: { username },
    });
    if (existingUsername) {
      throw new ApiError(409, "Username already taken!");
    }
    updateData.username = username;
  }

  const updatedUser = await prisma.user.update({
    where: { id: userId },
    data: updateData,
  });

  const { password: _, ...userWithoutPassword } = updatedUser;
  return userWithoutPassword;
};

const userUpdatePassword = async (userId: string, payload: TUpdatePasswordPayload) => {
  const { oldPassword, newPassword } = payload;

  if (!oldPassword || !newPassword) {
    throw new ApiError(400, "Old password and new password are required");
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    throw new ApiError(404, "User not found");
  }

  if (!user.password) {
    throw new ApiError(400, "Password not set for this user");
  }

  const isMatch = await bcrypt.compare(oldPassword, user.password);

  if (!isMatch) {
    throw new ApiError(400, "Old password is incorrect");
  }

  const hashPassword = await bcrypt.hash(newPassword, 10);

  await prisma.user.update({
    where: { id: userId },
    data: {
      password: hashPassword,
    },
  });

  return { message: "Password updated successfully" };
};

const userUpdateLanguageRegion = async (userId: string, payload: TUpdateLanguageRegionPayload) => {
  const {
    language,
    country,
    timeZone,
    dateFormat,
    timeFormat,
    units,
    currency,
  } = payload;

  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    throw new ApiError(404, "User not found");
  }

  const updateData: any = {};

  if (language !== undefined) updateData.language = language;
  if (country !== undefined) updateData.country = country;
  if (timeZone !== undefined) updateData.timeZone = timeZone;
  if (dateFormat !== undefined) updateData.dateFormat = dateFormat;
  if (timeFormat !== undefined) updateData.timeFormat = timeFormat;
  if (units !== undefined) updateData.units = units;
  if (currency !== undefined) updateData.currency = currency;

  const updatedUser = await prisma.user.update({
    where: { id: userId },
    data: updateData,
  });

  const { password: _, ...userWithoutPassword } = updatedUser;
  return userWithoutPassword;
};

const userUpdateDietaryPreferences = async (userId: string, payload: TUpdateDietaryPreferencesPayload) => {
  const { dietaryPreferences } = payload;

  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    throw new ApiError(404, "User not found");
  }

  const updatedUser = await prisma.user.update({
    where: { id: userId },
    data: {
      dietaryPreferences,
    },
  });

  const { password: _, ...userWithoutPassword } = updatedUser;
  return userWithoutPassword;
};

const userUpdateAllergies = async (userId: string, payload: TUpdateAllergiesPayload) => {
  const { allergies } = payload;

  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    throw new ApiError(404, "User not found");
  }

  const updatedUser = await prisma.user.update({
    where: { id: userId },
    data: {
      allergies,
    },
  });

  const { password: _, ...userWithoutPassword } = updatedUser;
  return userWithoutPassword;
};

const changeUserStatus = async (userId: string, adminId: string, payload: TChangeUserStatusPayload) => {
  const { status } = payload;

  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    throw new ApiError(404, "User not found");
  }

  // Prevent admin from suspending/deactivating themselves
  if (userId === adminId) {
    throw new ApiError(400, "You cannot suspend or deactivate your own account.");
  }

  // Prevent main admin from being suspended or deactivated
  if (user.email === config.admin.email) {
    throw new ApiError(403, "The main administrator cannot be suspended or deactivated.");
  }

  const updatedUser = await prisma.user.update({
    where: { id: userId },
    data: {
      status,
    },
  });

  const { password: _, ...userWithoutPassword } = updatedUser;
  return userWithoutPassword;
};

const deleteUser = async (userId: string, adminId: string) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    throw new ApiError(404, "User not found");
  }

  // Prevent admin from deleting themselves
  if (userId === adminId) {
    throw new ApiError(400, "You cannot delete your own account.");
  }

  // Prevent main admin from being deleted
  if (user.email === config.admin.email) {
    throw new ApiError(403, "The main administrator cannot be deleted.");
  }

  return prisma.user.delete({
    where: { id: userId },
  });
};

const switchUserRole = async (userId: string) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    throw new ApiError(404, "User not found");
  }

  // Only approved sellers (isSeller=true) can switch roles
  if (!user.isSeller) {
    throw new ApiError(403, "You are not an approved seller. Please apply to become a seller first.");
  }

  // Toggle between BUYER and SELLER
  const newRole = user.role === UserRole.SELLER ? UserRole.BUYER : UserRole.SELLER;

  const updatedUser = await prisma.user.update({
    where: { id: userId },
    data: { role: newRole },
  });

  // Generate fresh tokens with the new role
  const tokenPayload = {
    userId: updatedUser.id,
    email: updatedUser.email,
    role: updatedUser.role,
  };

  const accessToken = jwtHelper.generateToken(
    tokenPayload,
    config.jwt.accessToken as string,
    config.jwt.accessTokenExpiresIn as string,
  );

  const refreshToken = jwtHelper.generateToken(
    tokenPayload,
    config.jwt.refreshToken as string,
    config.jwt.refreshTokenExpiresIn as string,
  );

  const { password: _, ...userWithoutPassword } = updatedUser;
  return { user: userWithoutPassword, accessToken, refreshToken };
};

export const UserService = {
  createUser,
  getAllUsers,
  findUserById,
  getSingleUser,
  userUpdateProfile,
  userUpdatePassword,
  userUpdateLanguageRegion,
  userUpdateDietaryPreferences,
  userUpdateAllergies,
  changeUserStatus,
  deleteUser,
  switchUserRole,
};