import { z } from 'zod';

const loginValidationSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(1, 'Password is required'),
});

const socialLoginValidationSchema = z.object({
  token: z.string().min(1, 'Firebase token is required'),
});

const verifyEmailValidationSchema = z.object({
  email: z.string().email('Invalid email format'),
  code: z.string().length(6, 'Verification code must be exactly 6 characters'),
});

const verifyOtpValidationSchema = z.object({
  email: z.string().email('Invalid email format'),
  code: z.string().length(6, 'OTP code must be exactly 6 characters'),
});

const resendOtpValidationSchema = z.object({
  email: z.string().email('Invalid email format'),
  type: z.enum(['REGISTER_VERIFY', 'PASSWORD_RESET']),
});

export const AuthValidation = {
  loginValidationSchema,
  socialLoginValidationSchema,
  verifyEmailValidationSchema,
  verifyOtpValidationSchema,
  resendOtpValidationSchema,
};
