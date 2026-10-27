import { CuisineType, SellerRequestStatus } from '@prisma/client';
import { z } from 'zod';

const workingHoursSchema = z.record(
  z.string(),
  z.object({
    open: z.string().optional(),
    close: z.string().optional(),
    isOpen: z.boolean(),
  })
).optional();

const submitSellerRequestSchema = z.object({
  businessName: z.string().min(1, 'Business name is required'),
  ownerName: z.string().min(1, 'Owner name is required'),
  phone: z.string().min(1, 'Phone number is required'),
  cuisineTypes: z.array(z.nativeEnum(CuisineType)).min(1, 'At least one cuisine type is required'),
  description: z.string().min(10, 'Description must be at least 10 characters'),
  address: z.string().min(1, 'Address is required'),
  latitude: z.number({ message: 'Latitude is required' }),
  longitude: z.number({ message: 'Longitude is required' }),
  workingHours: workingHoursSchema,
  pickupAvailable: z.boolean().optional().default(false),
  deliveryAvailable: z.boolean().optional().default(false),
  kitchenImages: z.array(z.string()).min(5, 'At least 5 kitchen images are required'),
  governmentId: z.string().optional(),
});

const updateSellerProfileSchema = z.object({
  businessName: z.string().min(1).optional(),
  ownerName: z.string().min(1).optional(),
  phone: z.string().min(1).optional(),
  cuisineTypes: z.array(z.nativeEnum(CuisineType)).optional(),
  description: z.string().min(10).optional(),
  address: z.string().min(1).optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  workingHours: workingHoursSchema,
  pickupAvailable: z.boolean().optional(),
  deliveryAvailable: z.boolean().optional(),
  kitchenImages: z.array(z.string()).optional(),
  governmentId: z.string().optional(),
  profilePicture: z.string().optional(),
});

const approveRejectSellerSchema = z.object({
  status: z.nativeEnum(SellerRequestStatus).refine(
    (val) => val === SellerRequestStatus.APPROVED || val === SellerRequestStatus.REJECTED,
    { message: 'Status must be APPROVED or REJECTED' }
  ),
  adminNote: z.string().optional(),
});

const changeSellerStatusSchema = z.object({
  status: z.nativeEnum(SellerRequestStatus, {
    message: 'Status must be one of: PENDING, APPROVED, REJECTED, SUSPENDED',
  }),
  adminNote: z.string().optional(),
});

export const sellerValidation = {
  submitSellerRequestSchema,
  updateSellerProfileSchema,
  approveRejectSellerSchema,
  changeSellerStatusSchema,
};
