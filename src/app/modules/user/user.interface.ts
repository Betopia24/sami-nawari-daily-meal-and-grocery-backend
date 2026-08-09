import { UserStatus } from "@prisma/client";

export interface TUpdateProfilePayload {
  name?: string;
  phone?: string;
  username?: string;
  bio?: string;
  profilePicture?: string;
  birthday?: string;
  gender?: string;
  address?: string;
  isSeller?: boolean;
  dietaryPreferences?: string[];
  allergies?: string[];
  language?: string;
  country?: string;
  timeZone?: string;
  dateFormat?: string;
  timeFormat?: string;
  units?: string;
  currency?: string;
}

export interface TUpdatePasswordPayload {
  oldPassword?: string;
  newPassword?: string;
}

export interface TUpdateLanguageRegionPayload {
  language?: string;
  country?: string;
  timeZone?: string;
  dateFormat?: string;
  timeFormat?: string;
  units?: string;
  currency?: string;
}

export interface TUpdateDietaryPreferencesPayload {
  dietaryPreferences: string[];
}

export interface TUpdateAllergiesPayload {
  allergies: string[];
}

export interface TChangeUserStatusPayload {
  status: UserStatus;
}
