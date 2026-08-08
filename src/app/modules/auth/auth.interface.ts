export interface TRegisterUser {
  name: string;
  email: string;
  password: string;
  phone?: string;
}

export interface TSocialLoginPayload {
  token: string;
}

export interface TVerifyEmailPayload {
  email: string;
  code: string;
}

export interface TVerifyOtpPayload {
  email: string;
  code: string;
}

export interface TResendOtpPayload {
  email: string;
  type: 'REGISTER_VERIFY' | 'PASSWORD_RESET';
}
