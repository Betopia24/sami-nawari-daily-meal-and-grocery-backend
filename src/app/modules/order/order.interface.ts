export type TDeliveryAddress = {
  streetAddress: string;
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
};
