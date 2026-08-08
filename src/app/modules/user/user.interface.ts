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
}

export interface TUpdatePasswordPayload {
  oldPassword?: string;
  newPassword?: string;
}
