/* eslint-disable @typescript-eslint/consistent-type-definitions */
export type TCreateReviewPayload = {
  orderId: string;
  foodId: string;
  rating: number;
  comment: string;
};

export type TUpdateReviewPayload = {
  rating?: number;
  comment?: string;
};
