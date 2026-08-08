/* eslint-disable @typescript-eslint/no-unused-vars */
import bcrypt from 'bcrypt';
import { getAuth } from 'firebase-admin/auth';
import httpStatus from 'http-status';
import { Secret } from 'jsonwebtoken';
import config from '../../config';
import ApiError from '../../errors/apiError';
import { prisma } from '../../prisma/prisma';
import emailSender from '../../utils/emailSender';
import { jwtHelper } from '../../utils/JwtHelper';
import { TRegisterUser, TSocialLoginPayload } from './auth.interface';

const login = async (payload: { email: string; password: string }) => {
  const user = await prisma.user.findUniqueOrThrow({
    where: {
      email: payload.email,
    },
  });

  if (!user || !user.password) {
    throw new ApiError(401, 'Invalid credentials');
  }

  const isCorrectPassword = await bcrypt.compare(
    payload.password,
    user.password,
  );

  if (!isCorrectPassword) {
    throw new ApiError(401, 'Invalid credentials');
  }

  const accessToken = jwtHelper.generateToken(
    {
      userId: user.id,
      email: user.email,
      role: user.role,
    },
    config.jwt.accessToken as string,
    config.jwt.accessTokenExpiresIn as string,
  );
  const refreshToken = jwtHelper.generateToken(
    {
      userId: user.id,
      email: user.email,
      role: user.role,
    },
    config.jwt.refreshToken as string,
    config.jwt.refreshTokenExpiresIn as string,
  );

  return {
    accessToken,
    refreshToken,
  };
};

const forgotPassword = async (payload: { email: string }) => {
  const userData = await prisma.user.findUnique({
    where: {
      email: payload.email,
    },
  });

  if (!userData) {
    throw new ApiError(httpStatus.NOT_FOUND, 'User not found');
  }

  const resetToken = jwtHelper.generateToken(
    {
      id: userData.id,
      email: userData.email,
      role: userData.role,
    },
    config.jwt.reset_pass_secret as Secret,
    config.jwt.reset_pass_token_expires_in as string,
  );

  const resetLink = `${config.reset_pass_link}?token=${resetToken}`;

  await emailSender(
    'Reset Your Password',
    userData.email,
    `
        <p>Hello ${userData.name || 'User'},</p>
        <p>Click the link below to reset your password:</p>
         <a href="${resetLink}" style="text-decoration: none;">
            <button style="background-color: #007BFF; color: white; padding: 10px 20px; border: none; border-radius: 5px; font-size: 16px; cursor: pointer;">
              Reset Password
            </button>
          </a>
        <p>If you didn’t request this, ignore this email.</p>
        `,
  );

  return { message: 'Reset password email sent' };
};

const resetPassword = async (token: string, payload: { password: string }) => {
  // Verify token
  const decoded = jwtHelper.verifyToken(
    token,
    config.jwt.reset_pass_secret as Secret,
  );

  if (!decoded) {
    throw new ApiError(httpStatus.FORBIDDEN, 'Invalid or expired token!');
  }

  const user = await prisma.user.findUnique({
    where: {
      id: decoded.id,
    },
  });

  if (!user) {
    throw new ApiError(httpStatus.NOT_FOUND, 'User not found');
  }

  // Hash password
  const hashedPassword = await bcrypt.hash(
    payload.password,
    Number(config.salt_rounds),
  );

  // Update password
  await prisma.user.update({
    where: {
      id: user.id,
    },
    data: {
      password: hashedPassword,
    },
  });

  return { message: 'Password reset successful' };
};

const register = async (payload: TRegisterUser) => {
  const { name, email, password, phone } = payload;

  const isExistingUser = await prisma.user.findUnique({
    where: {
      email,
    },
  });

  if (isExistingUser) {
    throw new ApiError(409, 'User with this email already exists!');
  }

  const hashedPassword = await bcrypt.hash(
    password,
    Number(config.salt_rounds) || 12,
  );

  // Generate a unique username prefix
  let baseUsername = name.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (!baseUsername) {
    baseUsername = 'user';
  }
  let isUsernameUnique = false;
  let counter = 0;
  let finalUsername = baseUsername;

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

  const result = await prisma.user.create({
    data: {
      name,
      email,
      password: hashedPassword,
      phone,
      username: finalUsername,
      role: 'USER',
      status: 'ACTIVE',
      profilePicture:
        'https://i.ibb.co.com/q2gwGfV/356306451-54b19ada-d53e-4ee9-8882-9dfed1bf1396.jpg',
    },
    select: {
      id: true,
      name: true,
      email: true,
      username: true,
      phone: true,
      role: true,
      status: true,
      profilePicture: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return result;
};

const socialLogin = async (payload: TSocialLoginPayload) => {
  const { token } = payload;

  let decodedToken;
  try {
    decodedToken = await getAuth().verifyIdToken(token);
  } catch (error) {
    throw new ApiError(httpStatus.UNAUTHORIZED, 'Invalid or expired Firebase token!');
  }

  const { email, name, picture } = decodedToken;

  if (!email) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Email not found in social provider credentials!');
  }

  let user = await prisma.user.findUnique({
    where: {
      email,
    },
  });

  if (!user) {
    let baseUsername = (name || email.split('@')[0])
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '');
    if (!baseUsername) {
      baseUsername = 'user';
    }
    let isUsernameUnique = false;
    let counter = 0;
    let finalUsername = baseUsername;

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

    user = await prisma.user.create({
      data: {
        name: name || 'User',
        email,
        username: finalUsername,
        profilePicture:
          picture ||
          'https://i.ibb.co.com/q2gwGfV/356306451-54b19ada-d53e-4ee9-8882-9dfed1bf1396.jpg',
        role: 'USER',
        status: 'ACTIVE',
      },
    });
  }

  if (user.status !== 'ACTIVE') {
    throw new ApiError(
      httpStatus.FORBIDDEN,
      `Your account is ${user.status.toLowerCase()}`,
    );
  }

  const accessToken = jwtHelper.generateToken(
    {
      userId: user.id,
      email: user.email,
      role: user.role,
    },
    config.jwt.accessToken as string,
    config.jwt.accessTokenExpiresIn as string,
  );

  const refreshToken = jwtHelper.generateToken(
    {
      userId: user.id,
      email: user.email,
      role: user.role,
    },
    config.jwt.refreshToken as string,
    config.jwt.refreshTokenExpiresIn as string,
  );

  return {
    accessToken,
    refreshToken,
  };
};

export const AuthServices = {
  login,
  register,
  socialLogin,
  forgotPassword,
  resetPassword,
};
