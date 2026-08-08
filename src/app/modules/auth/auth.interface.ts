export interface TRegisterUser {
  name: string;
  email: string;
  password: string;
  phone?: string;
}

export interface TSocialLoginPayload {
  token: string;
}
