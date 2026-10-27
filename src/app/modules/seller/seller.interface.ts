import { CuisineType, SellerRequestStatus } from "@prisma/client";

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
  kitchenImages?: string[];
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
  kitchenImages?: string[];
  governmentId?: string;
  profilePicture?: string;
}

export interface TApproveRejectSellerPayload {
  status: 'APPROVED' | 'REJECTED';
  adminNote?: string;
}

export interface TChangeSellerStatusPayload {
  status: SellerRequestStatus;
  adminNote?: string;
}
