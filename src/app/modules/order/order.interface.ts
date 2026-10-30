/* eslint-disable @typescript-eslint/consistent-type-definitions */
import { PaymentMethod } from "@prisma/client";

export type TDeliveryAddress = {
  streetAddress: string;
  apt?: string;
  city: string;
  state?: string;
  postalCode?: string;
  country?: string;
};

export type TCreateOrderPayload = {
  deliveryAddress: TDeliveryAddress;
  recipientName: string;
  contactPhone: string;
  note?: string;
  paymentMethod: PaymentMethod;
};
