import { z } from 'zod';

const loginValidationSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(1, 'Password is required'),
});

const socialLoginValidationSchema = z.object({
  token: z.string().min(1, 'Firebase token is required'),
});

export const AuthValidation = {
  loginValidationSchema,
  socialLoginValidationSchema,
};
