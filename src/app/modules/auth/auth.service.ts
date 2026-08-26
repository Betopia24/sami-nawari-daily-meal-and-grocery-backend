/* eslint-disable @typescript-eslint/no-unused-vars */
import bcrypt from 'bcrypt';
import { getAuth } from 'firebase-admin/auth';
import httpStatus from 'http-status';
import { Secret } from 'jsonwebtoken';
import config from '../../config';
import ApiError from '../../errors/apiError';
import { prisma } from '../../prisma/prisma';
import emailSender from '../../utils/emailSender';
import { getOtpEmailTemplate } from '../../utils/emailTemplates';
import { jwtHelper } from '../../utils/JwtHelper';
import { TRegisterUser, TSocialLoginPayload, TVerifyEmailPayload, TVerifyOtpPayload, TResendOtpPayload } from './auth.interface';

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

  if (user.status === 'SUSPENDED') {
    throw new ApiError(httpStatus.FORBIDDEN, 'Your account has been suspended. Please contact support.');
  }

  if (user.status === 'INACTIVE') {
    return {
      isEmailVerified: false,
    };
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

  const resetOtp = Math.floor(100000 + Math.random() * 900000).toString();

  await prisma.verificationCode.upsert({
    where: {
      email_type: {
        email: userData.email,
        type: 'PASSWORD_RESET',
      },
    },
    update: {
      code: resetOtp,
      expiresAt: new Date(Date.now() + 5 * 60 * 1000), // 5 minutes
    },
    create: {
      email: userData.email,
      code: resetOtp,
      type: 'PASSWORD_RESET',
      expiresAt: new Date(Date.now() + 5 * 60 * 1000),
    },
  });

  await emailSender(
    'Reset Your Password',
    userData.email,
    getOtpEmailTemplate(
      userData.name || 'User',
      resetOtp,
      'Reset Your Password',
      'Please use the following 6-digit OTP to reset your password:'
    )
  );

  return { message: 'Password reset OTP sent successfully!' };
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
      role: 'BUYER',
      status: 'INACTIVE',
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

  // Generate 6-digit OTP
  const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();

  // Save OTP in DB
  await prisma.verificationCode.upsert({
    where: {
      email_type: {
        email,
        type: 'REGISTER_VERIFY',
      },
    },
    update: {
      code: verificationCode,
      expiresAt: new Date(Date.now() + 5 * 60 * 1000), // 5 minutes
    },
    create: {
      email,
      code: verificationCode,
      type: 'REGISTER_VERIFY',
      expiresAt: new Date(Date.now() + 5 * 60 * 1000),
    },
  });

  // Send email with OTP
  await emailSender(
    'Verify Your Email',
    email,
    getOtpEmailTemplate(
      name,
      verificationCode,
      'Verify Your Email',
      'Thank you for registering. Please use the following 6-digit verification code to verify your email address:'
    )
  );

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
        role: 'BUYER',
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

const verifyEmail = async (payload: TVerifyEmailPayload) => {
  const { email, code } = payload;

  const record = await prisma.verificationCode.findUnique({
    where: {
      email_type: {
        email,
        type: 'REGISTER_VERIFY',
      },
    },
  });

  if (!record) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Verification code not found or expired!');
  }

  if (record.code !== code) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Invalid verification code!');
  }

  if (new Date() > record.expiresAt) {
    throw new ApiError(httpStatus.GONE, 'Verification code has expired!');
  }

  const user = await prisma.user.update({
    where: { email },
    data: { status: 'ACTIVE' },
  });

  await prisma.verificationCode.delete({
    where: {
      email_type: {
        email,
        type: 'REGISTER_VERIFY',
      },
    },
  });

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
    message: 'Email verified successfully!',
    accessToken,
    refreshToken,
  };
};

const verifyOtp = async (payload: TVerifyOtpPayload) => {
  const { email, code } = payload;

  const record = await prisma.verificationCode.findUnique({
    where: {
      email_type: {
        email,
        type: 'PASSWORD_RESET',
      },
    },
  });

  if (!record) {
    throw new ApiError(httpStatus.NOT_FOUND, 'OTP code not found or expired!');
  }

  if (record.code !== code) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Invalid OTP code!');
  }

  if (new Date() > record.expiresAt) {
    throw new ApiError(httpStatus.GONE, 'OTP code has expired!');
  }

  const user = await prisma.user.findUnique({
    where: { email },
  });

  if (!user) {
    throw new ApiError(httpStatus.NOT_FOUND, 'User not found!');
  }

  const resetToken = jwtHelper.generateToken(
    {
      id: user.id,
      email: user.email,
      role: user.role,
    },
    config.jwt.reset_pass_secret as Secret,
    config.jwt.reset_pass_token_expires_in as string,
  );

  await prisma.verificationCode.delete({
    where: {
      email_type: {
        email,
        type: 'PASSWORD_RESET',
      },
    },
  });

  return {
    message: 'OTP verified successfully!',
    resetToken,
  };
};

const resendOtp = async (payload: TResendOtpPayload) => {
  const { email, type } = payload;

  const user = await prisma.user.findUnique({
    where: { email },
  });

  if (!user) {
    throw new ApiError(httpStatus.NOT_FOUND, 'User not found!');
  }

  const newCode = Math.floor(100000 + Math.random() * 900000).toString();

  await prisma.verificationCode.upsert({
    where: {
      email_type: {
        email,
        type,
      },
    },
    update: {
      code: newCode,
      expiresAt: new Date(Date.now() + 5 * 60 * 1000),
    },
    create: {
      email,
      code: newCode,
      type,
      expiresAt: new Date(Date.now() + 5 * 60 * 1000),
    },
  });

  const subject = type === 'REGISTER_VERIFY' ? 'Verify Your Email' : 'Reset Your Password';
  const messageText = type === 'REGISTER_VERIFY' 
    ? 'Please use the following code to verify your email address:'
    : 'Please use the following code to reset your password:';

  await emailSender(
    subject,
    email,
    getOtpEmailTemplate(
      user.name,
      newCode,
      subject,
      messageText
    )
  );

  return { message: 'Verification code resent successfully!' };
};

export const AuthServices = {
  login,
  register,
  socialLogin,
  verifyEmail,
  verifyOtp,
  resendOtp,
  forgotPassword,
  resetPassword,
};
