export interface TAddToCartPayload {
  foodId: string;
  quantity: number;
}

export interface TUpdateQuantityPayload {
  foodId: string;
  action: "increase" | "decrease";
}

export interface TCartItem {
  foodId: string;
  quantity: number;
  name: string;
  price: number;
  image: string;
  category: string;
  pickupAvailable: boolean;
  deliveryAvailable: boolean;
  deliveryFee: number;
  subTotal: number;
}

export interface TCartResponse {
  items: TCartItem[];
  totalItems: number;
  subTotal: number;
  deliveryFee: number;
  totalPrice: number;
}
