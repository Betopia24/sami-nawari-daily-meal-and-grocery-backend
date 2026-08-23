/* eslint-disable @typescript-eslint/no-explicit-any */
import { FoodStatus, OrderStatus, PaymentStatus, UserStatus } from "@prisma/client";
import ApiError from "../../errors/apiError";
import { prisma } from "../../prisma/prisma";
import redis from "../../utils/redisClient";
import { TCreateOrderPayload } from "./order.interface";

const createOrder = async (userId: string, payload: TCreateOrderPayload) => {
  const cartKey = `cart:${userId}`;

  // 1. Fetch user's cart from Redis
  const cartData = await redis.hgetall(cartKey);
  if (!cartData || Object.keys(cartData).length === 0) {
    throw new ApiError(400, "Your cart is empty. Please add items before checking out.");
  }

  const foodIds = Object.keys(cartData);

  // 2. Fetch corresponding food items and validate they are active & published
  const foods = await prisma.food.findMany({
    where: { id: { in: foodIds } },
    include: {
      seller: {
        select: {
          id: true,
          status: true,
        },
      },
    },
  });

  const foodMap = new Map(foods.map((food) => [food.id, food]));
  const orderItems: {
    foodId: string;
    foodName: string;
    quantity: number;
    unitPrice: number;
    subtotal: number;
  }[] = [];
  const sellerDeliveryFees = new Map<string, number>();

  for (const foodId of foodIds) {
    const quantity = Number(cartData[foodId]) || 0;
    const food = foodMap.get(foodId);

    if (!food) {
      throw new ApiError(404, `Food item with ID ${foodId} not found.`);
    }

    if (food.status !== FoodStatus.PUBLISHED) {
      throw new ApiError(400, `Food item "${food.name}" is no longer available.`);
    }

    if (food.seller.status !== UserStatus.ACTIVE) {
      throw new ApiError(400, `The seller for "${food.name}" is currently suspended or inactive.`);
    }

    if (quantity <= 0) {
      throw new ApiError(400, `Invalid quantity for food item "${food.name}".`);
    }

    const subtotal = Number((food.price * quantity).toFixed(2));
    orderItems.push({
      foodId,
      foodName: food.name,
      quantity,
      unitPrice: food.price,
      subtotal,
    });

    if (food.deliveryAvailable) {
      const currentFee = food.deliveryFee || 0;
      const existingFee = sellerDeliveryFees.get(food.sellerId) || 0;
      if (currentFee > existingFee) {
        sellerDeliveryFees.set(food.sellerId, currentFee);
      }
    }
  }

  // 3. Recalculate totals backend-side (Never trust frontend pricing calculations)
  const subTotal = Number(
    orderItems.reduce((acc, item) => acc + item.subtotal, 0).toFixed(2)
  );

  let deliveryFee = 0;
  sellerDeliveryFees.forEach((fee) => {
    deliveryFee += fee;
  });
  deliveryFee = Number(deliveryFee.toFixed(2));

  const totalPrice = Number((subTotal + deliveryFee).toFixed(2));

  // 4. Generate unique human-readable Order Number
  const today = new Date();
  const dateStr = 
    today.getFullYear().toString() +
    (today.getMonth() + 1).toString().padStart(2, "0") +
    today.getDate().toString().padStart(2, "0");
  const randomSuffix = Math.floor(1000 + Math.random() * 9000);
  const orderNumber = `ORD-${dateStr}-${randomSuffix}`;

  // 5. Database transaction for Order Creation
  const newOrder = await prisma.$transaction(async (tx) => {
    const order = await tx.order.create({
      data: {
        orderNumber,
        userId,
        deliveryAddress: payload.deliveryAddress,
        recipientName: payload.recipientName,
        contactPhone: payload.contactPhone,
        note: payload.note || null,
        items: orderItems,
        subTotal,
        deliveryFee,
        totalPrice,
        status: OrderStatus.PENDING_PAYMENT,
        paymentStatus: PaymentStatus.PENDING,
      },
    });

    return order;
  });

  // 6. Safe cart clearance: only remove purchased fields to avoid wiping concurrent cart changes
  try {
    await redis.hdel(cartKey, ...foodIds);
  } catch (redisErr) {
    // Log error but don't fail the order response since the permanent DB entry succeeded
    console.error("Redis Safe Cart Clear Failure on Checkout:", redisErr);
  }

  return newOrder;
};

const getMyOrders = async (userId: string, query: Record<string, any>) => {
  const page = Number(query.page) || 1;
  const limit = Number(query.limit) || 10;
  const skip = (page - 1) * limit;

  const [data, total] = await Promise.all([
    prisma.order.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    }),
    prisma.order.count({ where: { userId } }),
  ]);

  return {
    meta: {
      page,
      limit,
      total,
      totalPage: Math.ceil(total / limit),
    },
    data,
  };
};

const getOrderById = async (userId: string, orderId: string) => {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
  });

  if (!order) {
    throw new ApiError(404, "Order not found.");
  }

  if (order.userId !== userId) {
    throw new ApiError(403, "You do not have permission to view this order.");
  }

  return order;
};

const cancelOrder = async (userId: string, orderId: string) => {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
  });

  if (!order) {
    throw new ApiError(404, "Order not found.");
  }

  if (order.userId !== userId) {
    throw new ApiError(403, "You do not have permission to cancel this order.");
  }

  // Enforce cancel eligibility lifecycle rules
  if (order.status !== OrderStatus.PENDING_PAYMENT && order.status !== OrderStatus.CONFIRMED) {
    throw new ApiError(
      400,
      `Cannot cancel this order because it is already in status: ${order.status}`
    );
  }

  const updatedOrder = await prisma.order.update({
    where: { id: orderId },
    data: {
      status: OrderStatus.CANCELLED,
      paymentStatus: PaymentStatus.CANCELLED,
    },
  });

  return updatedOrder;
};

export const OrderService = {
  createOrder,
  getMyOrders,
  getOrderById,
  cancelOrder,
};
