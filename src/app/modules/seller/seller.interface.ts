import { CuisineType } from "@prisma/client";

export interface TSubmitSellerRequestPayload {
  businessName: string;
  ownerName: string;
  phone: string;
  cuisineTypes: CuisineType[];
  description: string;
  address: string;
  latitude?: number;
  longitude?: number;
  workingHours?: Record<string, { open?: string; close?: string; isOpen: boolean }>;
  pickupAvailable?: boolean;
  deliveryAvailable?: boolean;
  governmentId?: string;
}

export interface TUpdateSellerProfilePayload {
  businessName?: string;
  ownerName?: string;
  phone?: string;
  cuisineTypes?: CuisineType[];
  description?: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  workingHours?: Record<string, { open?: string; close?: string; isOpen: boolean }>;
  pickupAvailable?: boolean;
  deliveryAvailable?: boolean;
  governmentId?: string;
  profilePicture?: string;
}

export interface TApproveRejectSellerPayload {
  status: 'APPROVED' | 'REJECTED';
  adminNote?: string;
}
