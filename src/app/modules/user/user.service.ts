/* eslint-disable @typescript-eslint/no-explicit-any */
import bcrypt from "bcryptjs";
import { Request } from "express";
import ApiError from "../../errors/apiError";
import { prisma } from "../../prisma/prisma";
import { PrismaQueryBuilder } from "../../utils/QueryBuilder";
import { UserRole } from "@prisma/client";
import { TUpdateProfilePayload, TUpdatePasswordPayload } from "./user.interface";

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
      role: role ?? UserRole.USER,
      phone,
      username: finalUsername,
      isSeller: isSeller ?? false,
      dietaryPreferences: dietaryPreferences ?? [],
      allergies: allergies ?? [],
      profilePicture: req.body.profilePicture ?? "https://i.ibb.co.com/q2gwGfV/356306451-54b19ada-d53e-4ee9-8882-9dfed1bf1396.jpg",
    },
  });

  return result;
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
  const qb = new PrismaQueryBuilder(query)
    .filter()
    .search(["name", "email"])
    .sort()
    .fields()
    .paginate();

  const prismaQuery = qb.build();

  const [data, total] = await Promise.all([
    prisma.user.findMany({
      ...prismaQuery,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        profilePicture: true,
        createdAt: true,
        updatedAt: true,
      },
    }),
    prisma.user.count({ where: prismaQuery.where }),
  ]);

  return {
    meta: qb.getMeta(total),
    data,
  };
};



const getSingleUser = async (userId: string) => {
  return prisma.user.findUnique({
    where: { id: userId },
  });
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

  return updatedUser;
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

const deleteUser = async (userId: string) => {
  return prisma.user.delete({
    where: { id: userId },
  });
};

export const UserService = {
  createUser,
  getAllUsers,
  findUserById,
  getSingleUser,
  userUpdateProfile,
  userUpdatePassword,
  deleteUser,
};