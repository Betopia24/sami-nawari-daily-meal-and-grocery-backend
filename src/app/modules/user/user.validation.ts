import { z } from 'zod';

const createUserValidationSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().email('Invalid email format'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  role: z.enum(['USER', 'ADMIN']).default('USER'),
});

const registerUserValidationSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().email('Invalid email format'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  phone: z.string().optional(),
});

const updateUserValidationSchema = z.object({
  name: z.string().min(1).optional(),
  phone: z.string().optional(),
  username: z.string().min(1).optional(),
  bio: z.string().optional(),
  profilePicture: z.string().optional(),
  birthday: z.string().optional(),
  gender: z.string().optional(),
  address: z.string().optional(),
  isSeller: z.boolean().optional(),
  dietaryPreferences: z.array(z.string()).optional(),
  allergies: z.array(z.string()).optional(),
  language: z.string().optional(),
  country: z.string().optional(),
  timeZone: z.string().optional(),
  dateFormat: z.string().optional(),
  timeFormat: z.string().optional(),
  units: z.string().optional(),
  currency: z.string().optional(),
});

const updatePasswordValidationSchema = z.object({
  oldPassword: z.string().min(6, 'Old password must be at least 6 characters'),
  newPassword: z.string().min(6, 'New password must be at least 6 characters'),
});

const updateLanguageRegionValidationSchema = z.object({
  language: z.string().optional(),
  country: z.string().optional(),
  timeZone: z.string().optional(),
  dateFormat: z.string().optional(),
  timeFormat: z.string().optional(),
  units: z.string().optional(),
  currency: z.string().optional(),
});

const updateDietaryPreferencesValidationSchema = z.object({
  dietaryPreferences: z.array(z.string()),
});

const updateAllergiesValidationSchema = z.object({
  allergies: z.array(z.string()),
});

export const userValidation = {
  createUserValidationSchema,
  registerUserValidationSchema,
  updateUserValidationSchema,
  updatePasswordValidationSchema,
  updateLanguageRegionValidationSchema,
  updateDietaryPreferencesValidationSchema,
  updateAllergiesValidationSchema,
};
