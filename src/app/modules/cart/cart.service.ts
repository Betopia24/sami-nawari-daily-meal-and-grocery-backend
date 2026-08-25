/* eslint-disable @typescript-eslint/no-unused-vars */
import { FoodStatus } from "@prisma/client";
import ApiError from "../../errors/apiError";
import { prisma } from "../../prisma/prisma";
import redis from "../../utils/redisClient";
import { TAddToCartPayload, TUpdateQuantityPayload, TCartResponse } from "./cart.interface";

const getCartKey = (userId: string) => `cart:${userId}`;
const CART_TTL_SECONDS = 60 * 24 * 60 * 60; // 60 days — auto-expire abandoned carts

const addItemToCart = async (userId: string, payload: TAddToCartPayload) => {
  const { foodId, quantity } = payload;
  const key = getCartKey(userId);
  const food = await prisma.food.findUnique({
    where: { id: foodId },
  });

  if (!food) {
    throw new ApiError(404, "Food item not found.");
  }

  if (food.status !== FoodStatus.PUBLISHED) {
    throw new ApiError(400, "This food item is currently unavailable.");
  }



  try {
    // Atomic HSETNX: sets field ONLY if it doesn't exist — prevents race conditions
    const isNew = await redis.hsetnx(key, foodId, quantity.toString());
    if (isNew === 0) {
      throw new ApiError(400, "This food item is already in your cart. Please update the quantity instead.");
    }

    // Renew TTL on every cart modification to prevent memory leaks
    await redis.expire(key, CART_TTL_SECONDS);

    return {
      message: "Item added to cart successfully",
      foodId,
      quantity,
    };
  } catch (error) {
    if (error instanceof ApiError) throw error;
    console.error("Redis AddToCart Error:", error);
    throw new ApiError(500, "Database cache error. Please try again later.");
  }
};


const getCart = async (userId: string): Promise<TCartResponse> => {
  const key = getCartKey(userId);

  try {
    const cartData = await redis.hgetall(key);
    if (!cartData || Object.keys(cartData).length === 0) {
      return {
        items: [],
        totalItems: 0,
        subTotal: 0,
        deliveryFee: 0,
        totalPrice: 0,
      };
    }

    const foodIds = Object.keys(cartData);

    const foods = await prisma.food.findMany({
      where: { id: { in: foodIds } },
    });

    const foodMap = new Map(foods.map((food) => [food.id, food]));
    const items = [];
    const sellerDeliveryFees = new Map<string, number>();

    // Collect invalid items during loop, then batch-delete in one Redis round-trip
    const invalidFoodIds: string[] = [];

    for (const foodId of foodIds) {
      const quantity = Number(cartData[foodId]) || 0;
      const food = foodMap.get(foodId);

      if (!food || food.status !== FoodStatus.PUBLISHED) {
        invalidFoodIds.push(foodId); // collect, don't delete yet
        continue;
      }

      const subTotal = food.price * quantity;

      items.push({
        foodId,
        quantity,
        name: food.name,
        price: food.price,
        image: food.images[0] || "",
        category: food.category,
        pickupAvailable: food.pickupAvailable,
        deliveryAvailable: food.deliveryAvailable,
        deliveryFee: food.deliveryFee,
        subTotal,
        sellerId: food.sellerId,
      });

      if (food.deliveryAvailable) {
        const currentFee = food.deliveryFee || 0;
        const existingFee = sellerDeliveryFees.get(food.sellerId) || 0;
        if (currentFee > existingFee) {
          sellerDeliveryFees.set(food.sellerId, currentFee);
        }
      }
    }

    // Batch delete all invalid/unpublished items in a single Redis call — O(1) network trip
    if (invalidFoodIds.length > 0) {
      await redis.hdel(key, ...invalidFoodIds);
    }

    const totalItems = items.reduce((acc, item) => acc + item.quantity, 0);
    const subTotal = items.reduce((acc, item) => acc + item.subTotal, 0);

   
    let deliveryFee = 0;
    sellerDeliveryFees.forEach((fee) => {
      deliveryFee += fee;
    });

    const totalPrice = subTotal + deliveryFee;


    const formattedItems = items.map(({ sellerId: _, ...rest }) => rest);

    return {
      items: formattedItems,
      totalItems,
      subTotal: Number(subTotal.toFixed(2)),
      deliveryFee: Number(deliveryFee.toFixed(2)),
      totalPrice: Number(totalPrice.toFixed(2)),
    };
  } catch (error) {
    console.error("Redis GetCart Error:", error);
    throw new ApiError(500, "Database cache error. Please try again later.");
  }
};

const updateItemQuantity = async (userId: string, payload: TUpdateQuantityPayload) => {
  const { foodId, action } = payload;
  const key = getCartKey(userId);

  try {
    const exists = await redis.hexists(key, foodId);
    if (!exists) {
      throw new ApiError(404, "Item not found in cart.");
    }

    const food = await prisma.food.findUnique({
      where: { id: foodId },
    });

    if (!food || food.status !== FoodStatus.PUBLISHED) {
      await redis.hdel(key, foodId);
      throw new ApiError(400, "This food item is no longer available.");
    }

    const increment = action === "increase" ? 1 : -1;
    const newQuantity = await redis.hincrby(key, foodId, increment);

    if (newQuantity <= 0) {
      await redis.hdel(key, foodId);
      return {
        message: "Item removed from cart because quantity reached zero",
        foodId,
        quantity: 0,
      };
    }

    // Renew TTL on every modification to keep active carts alive
    await redis.expire(key, CART_TTL_SECONDS);

    return {
      message: `Item quantity ${action === "increase" ? "increased" : "decreased"} successfully`,
      foodId,
      quantity: newQuantity,
    };
  } catch (error) {
    if (error instanceof ApiError) throw error;
    console.error("Redis UpdateQuantity Error:", error);
    throw new ApiError(500, "Database cache error. Please try again later.");
  }
};


const removeItemFromCart = async (userId: string, foodId: string) => {
  const key = getCartKey(userId);

  try {
    const exists = await redis.hexists(key, foodId);
    if (!exists) {
      throw new ApiError(404, "Item not found in cart.");
    }

    await redis.hdel(key, foodId);

    return {
      message: "Item removed from cart successfully",
      foodId,
    };
  } catch (error) {
    if (error instanceof ApiError) throw error;
    console.error("Redis RemoveItem Error:", error);
    throw new ApiError(500, "Database cache error. Please try again later.");
  }
};


const clearCart = async (userId: string) => {
  const key = getCartKey(userId);

  try {
    await redis.del(key);

    return {
      message: "Cart cleared successfully",
    };
  } catch (error) {
    console.error("Redis ClearCart Error:", error);
    throw new ApiError(500, "Database cache error. Please try again later.");
  }
};

export const CartService = {
  addItemToCart,
  getCart,
  updateItemQuantity,
  removeItemFromCart,
  clearCart,
};
