import { Request, Response } from 'express';
import HttpStatus from 'http-status';
import ApiError from '../../errors/apiError';
import catchAsync from '../../utils/catchAsync';
import sendResponse from '../../utils/sendResponse';
import { AuthServices } from './auth.service';

const login = catchAsync(async (req: Request, res: Response) => {
  const result = await AuthServices.login(req.body);

  if ('isEmailVerified' in result) {
    return sendResponse(res, {
      statusCode: 403,
      success: false,
      message: 'Please verify your email first!',
      data: {
        isEmailVerified: false,
      },
    });
  }

  const { accessToken, refreshToken } = result;

  const isSecure = req.secure || req.headers['x-forwarded-proto'] === 'https';

  res.cookie('accessToken', accessToken, {
    secure: isSecure,
    httpOnly: true,
    sameSite: isSecure ? 'none' : 'lax',
    maxAge: 1000 * 60 * 60 * 24 * 365,
  });
  res.cookie('refreshToken', refreshToken, {
    secure: isSecure,
    httpOnly: true,
    sameSite: isSecure ? 'none' : 'lax',
    maxAge: 1000 * 60 * 60 * 24 * 365,
  });
  sendResponse(res, {
    statusCode: 201,
    success: true,
    message: 'User loggedin successfully!',
    data: {
      accessToken,
      refreshToken,
    },
  });
});

const logout = catchAsync(async (req: Request, res: Response) => {
  res.clearCookie('accessToken');
  res.clearCookie('refreshToken');
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: 'User logged out successfully!',
    data: null,
  });
});

const forgotPassword = catchAsync(async (req: Request, res: Response) => {
  await AuthServices.forgotPassword(req.body);

  sendResponse(res, {
    statusCode: HttpStatus.OK,
    success: true,
    message: 'Check your email for reset password link!',
    data: null,
  });
});

const resetPassword = catchAsync(async (req: Request, res: Response) => {
  const token = req.query.token as string;

  if (!token) {
    throw new ApiError(HttpStatus.UNAUTHORIZED, 'Reset token is required!');
  }

  await AuthServices.resetPassword(token, req.body);

  sendResponse(res, {
    statusCode: HttpStatus.OK,
    success: true,
    message: 'Password reset successfully!',
    data: null,
  });
});

const register = catchAsync(async (req: Request, res: Response) => {
  const result = await AuthServices.register(req.body);

  sendResponse(res, {
    statusCode: 201,
    success: true,
    message: 'User registered successfully!',
    data: result,
  });
});

const socialLogin = catchAsync(async (req: Request, res: Response) => {
  const result = await AuthServices.socialLogin(req.body);
  const { accessToken, refreshToken } = result;

  const isSecure = req.secure || req.headers['x-forwarded-proto'] === 'https';

  res.cookie('accessToken', accessToken, {
    secure: isSecure,
    httpOnly: true,
    sameSite: isSecure ? 'none' : 'lax',
    maxAge: 1000 * 60 * 60 * 24 * 365,
  });
  res.cookie('refreshToken', refreshToken, {
    secure: isSecure,
    httpOnly: true,
    sameSite: isSecure ? 'none' : 'lax',
    maxAge: 1000 * 60 * 60 * 24 * 365,
  });

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: 'User logged in successfully with social provider!',
    data: {
      accessToken,
      refreshToken,
    },
  });
});

const verifyEmail = catchAsync(async (req: Request, res: Response) => {
  const result = await AuthServices.verifyEmail(req.body);
  const { accessToken, refreshToken, message } = result;

  const isSecure = req.secure || req.headers['x-forwarded-proto'] === 'https';

  res.cookie('accessToken', accessToken, {
    secure: isSecure,
    httpOnly: true,
    sameSite: isSecure ? 'none' : 'lax',
    maxAge: 1000 * 60 * 60 * 24 * 365,
  });
  res.cookie('refreshToken', refreshToken, {
    secure: isSecure,
    httpOnly: true,
    sameSite: isSecure ? 'none' : 'lax',
    maxAge: 1000 * 60 * 60 * 24 * 365,
  });

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message,
    data: {
      accessToken,
      refreshToken,
    },
  });
});

const verifyOtp = catchAsync(async (req: Request, res: Response) => {
  const result = await AuthServices.verifyOtp(req.body);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: result.message,
    data: {
      resetToken: result.resetToken,
    },
  });
});

const resendOtp = catchAsync(async (req: Request, res: Response) => {
  const result = await AuthServices.resendOtp(req.body);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: result.message,
    data: null,
  });
});

export const AuthController = {
  login,
  register,
  socialLogin,
  verifyEmail,
  verifyOtp,
  resendOtp,
  logout,
  forgotPassword,
  resetPassword,
};
