/* eslint-disable @typescript-eslint/no-explicit-any */
import { FoodStatus, OrderStatus, PaymentStatus, UserStatus, PaymentMethod, OutboxEventType, OutboxStatus } from "@prisma/client";
import ApiError from "../../errors/apiError";
import { prisma } from "../../prisma/prisma";
import redis from "../../utils/redisClient";
import { outboxQueue } from "../../jobs/queue";
import { TCreateOrderPayload } from "./order.interface";

const createOrder = async (userId: string, payload: TCreateOrderPayload) => {
  const lockKey = `lock:checkout:${userId}`;
  const lockAcquired = await redis.set(lockKey, "locked", "NX" as any, "PX" as any, 10000 as any); // 10s TTL lock
  if (!lockAcquired) {
    throw new ApiError(409, "Another checkout request is currently in progress. Please wait.");
  }

  try {
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
      sellerId: string;
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

      if (!food.deliveryAvailable) {
        throw new ApiError(400, `Delivery is not available for food item "${food.name}".`);
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

    // 3. Recalculate totals backend-side
    const subTotal = Number(
      orderItems.reduce((acc, item) => acc + item.subtotal, 0).toFixed(2)
    );

    let deliveryFee = 0;
    sellerDeliveryFees.forEach((fee) => {
      deliveryFee += fee;
    });
    deliveryFee = Number(deliveryFee.toFixed(2));

    const totalPrice = Number((subTotal + deliveryFee).toFixed(2));

    // 4. Generate unique base human-readable Order Number
    const today = new Date();
    const dateStr = 
      today.getFullYear().toString() +
      (today.getMonth() + 1).toString().padStart(2, "0") +
      today.getDate().toString().padStart(2, "0");
    
    const counterKey = `order:counter:${dateStr}`;
    const sequenceNum = await redis.incr(counterKey);
    await redis.expire(counterKey, 86400); // Set TTL to 24h
    const baseOrderNumber = `ORD-${dateStr}-${sequenceNum.toString().padStart(5, "0")}`;

    const orderStatus = payload.paymentMethod === PaymentMethod.CASH_ON_DELIVERY
      ? OrderStatus.CONFIRMED
      : OrderStatus.PENDING_PAYMENT;
    
    const paymentStatus = payload.paymentMethod === PaymentMethod.CASH_ON_DELIVERY
      ? PaymentStatus.UNPAID
      : PaymentStatus.PENDING;

    // 5. Database transaction for Order Creation & Splitting
    const { parentOrder, outboxEvent } = await prisma.$transaction(async (tx) => {
      // Create the Parent Order
      const parent = await tx.order.create({
        data: {
          orderNumber: baseOrderNumber,
          userId,
          deliveryAddress: payload.deliveryAddress,
          recipientName: payload.recipientName,
          contactPhone: payload.contactPhone,
          note: payload.note || null,
          items: orderItems,
          subTotal,
          deliveryFee,
          totalPrice,
          status: orderStatus,
          paymentStatus,
          paymentMethod: payload.paymentMethod,
          parentId: null,
        },
      });

      // Group items by seller
      const itemsBySeller = new Map<string, typeof orderItems>();
      for (const item of orderItems) {
        const list = itemsBySeller.get(item.sellerId) || [];
        list.push(item);
        itemsBySeller.set(item.sellerId, list);
      }

      // Create Child Orders per seller
      let index = 0;
      for (const [sellerId, sellerItems] of itemsBySeller.entries()) {
        const childSubTotal = Number(
          sellerItems.reduce((acc, item) => acc + item.subtotal, 0).toFixed(2)
        );
        const childDeliveryFee = sellerDeliveryFees.get(sellerId) || 0;
        const childTotalPrice = Number((childSubTotal + childDeliveryFee).toFixed(2));

        await tx.order.create({
          data: {
            orderNumber: `${baseOrderNumber}-S${index + 1}`,
            userId,
            deliveryAddress: payload.deliveryAddress,
            recipientName: payload.recipientName,
            contactPhone: payload.contactPhone,
            note: payload.note || null,
            items: sellerItems,
            subTotal: childSubTotal,
            deliveryFee: childDeliveryFee,
            totalPrice: childTotalPrice,
            status: orderStatus,
            paymentStatus,
            paymentMethod: payload.paymentMethod,
            parentId: parent.id,
          },
        });
        index++;
      }

      // Create the Outbox Event atomically
      const event = await tx.outboxEvent.create({
        data: {
          eventType: OutboxEventType.ORDER_CREATED,
          payload: {
            id: parent.id,
            orderNumber: parent.orderNumber,
          },
          status: OutboxStatus.PENDING,
        },
      });

      return { parentOrder: parent, outboxEvent: event };
    });

    try {
      await outboxQueue.add(OutboxEventType.ORDER_CREATED, { outboxId: outboxEvent.id });
      console.log(` Enqueued ${OutboxEventType.ORDER_CREATED} outbox event ${outboxEvent.id} in BullMQ`);
    } catch (queueErr) {
      console.error(" Failed to enqueue outbox event in BullMQ:", queueErr);
    }

    // 6. Safe cart clearance: only remove purchased fields to avoid wiping concurrent cart changes
    try {
      await redis.hdel(cartKey, ...foodIds);
    } catch (redisErr) {
      console.error("Redis Safe Cart Clear Failure on Checkout:", redisErr);
    }

    // Retrieve full parent order with split children included
    const resultOrder = await prisma.order.findUnique({
      where: { id: parentOrder.id },
      include: {
        childOrders: true,
      },
    });

    return resultOrder;
  } finally {
    // Release the lock
    await redis.del(lockKey);
  }
};

const getMyOrders = async (userId: string, query: Record<string, any>) => {
  const page = Number(query.page) || 1;
  const limit = Number(query.limit) || 10;
  const skip = (page - 1) * limit;

  const [data, total] = await Promise.all([
    prisma.order.findMany({
      where: { userId, parentId: null },
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
      include: {
        childOrders: true,
      },
    }),
    prisma.order.count({ where: { userId, parentId: null } }),
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
    include: {
      childOrders: true,
    },
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
    include: {
      childOrders: true,
    },
  });

  if (!order) {
    throw new ApiError(404, "Order not found.");
  }

  // Fix: Only parent orders can be cancelled by a buyer.
  // Allowing child-order cancellation would leave the parent in a stale active state.
  if (order.parentId) {
    throw new ApiError(400, "Please cancel the main order directly.");
  }

  if (order.userId !== userId) {
    throw new ApiError(403, "You do not have permission to cancel this order.");
  }

  const allowedCancelStates: OrderStatus[] = [OrderStatus.PENDING_PAYMENT, OrderStatus.CONFIRMED];
  if (!allowedCancelStates.includes(order.status)) {
    throw new ApiError(400, `Cannot cancel order in status ${order.status}`);
  }

  const updatedOrder = await prisma.$transaction(async (tx) => {
    const parent = await tx.order.update({
      where: { id: orderId },
      data: {
        status: OrderStatus.CANCELLED,
        paymentStatus: PaymentStatus.CANCELLED,
      },
    });

    await tx.order.updateMany({
      where: { parentId: orderId },
      data: {
        status: OrderStatus.CANCELLED,
        paymentStatus: PaymentStatus.CANCELLED,
      },
    });

    return parent;
  });

  return updatedOrder;
};

const reorder = async (userId: string, orderId: string) => {
  const oldOrder = await prisma.order.findUnique({
    where: { id: orderId },
  });

  if (!oldOrder) {
    throw new ApiError(404, "Original order not found.");
  }

  if (oldOrder.userId !== userId) {
    throw new ApiError(403, "You do not have permission to reorder from this order.");
  }

  // Populate redis cart temporarily and call createOrder
  const cartKey = `cart:${userId}`;
  const reorderFoodIds = oldOrder.items.map((i) => i.foodId);
  const cartPipeline = redis.pipeline();
  for (const item of oldOrder.items) {
    cartPipeline.hset(cartKey, item.foodId, item.quantity.toString());
  }
  await cartPipeline.exec();

  const payload = {
    deliveryAddress: {
      streetAddress: oldOrder.deliveryAddress.streetAddress,
      city: oldOrder.deliveryAddress.city,
      state: oldOrder.deliveryAddress.state ?? undefined,
      postalCode: oldOrder.deliveryAddress.postalCode ?? undefined,
      country: oldOrder.deliveryAddress.country ?? undefined,
    },
    recipientName: oldOrder.recipientName,
    contactPhone: oldOrder.contactPhone,
    note: oldOrder.note || undefined,
    paymentMethod: oldOrder.paymentMethod,
  };

  // Fix: Clean up the temporary cart items if createOrder fails,
  // to prevent polluting the user's active cart.
  try {
    return await createOrder(userId, payload);
  } catch (err) {
    await redis.hdel(cartKey, ...reorderFoodIds);
    throw err;
  }
};

const getSellerOrders = async (sellerId: string, query: Record<string, any>) => {
  const page = Number(query.page) || 1;
  const limit = Number(query.limit) || 10;
  const skip = (page - 1) * limit;

  const whereCondition: any = {
    parentId: { not: null },
    items: {
      some: {
        sellerId,
      },
    },
  };

  if (query.status) {
    whereCondition.status = query.status as OrderStatus;
  }

  const [data, total] = await Promise.all([
    prisma.order.findMany({
      where: whereCondition,
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    }),
    prisma.order.count({ where: whereCondition }),
  ]);

  const formattedData = data.map((order) => {
    const sellerItems = order.items.filter((item) => item.sellerId === sellerId);
    const sellerSubTotal = Number(
      sellerItems.reduce((acc, item) => acc + item.subtotal, 0).toFixed(2)
    );
    return {
      ...order,
      items: sellerItems,
      sellerSubTotal,
    };
  });

  return {
    meta: {
      page,
      limit,
      total,
      totalPage: Math.ceil(total / limit),
    },
    data: formattedData,
  };
};

const getSellerOrderById = async (sellerId: string, orderId: string) => {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
  });

  if (!order) {
    throw new ApiError(404, "Order not found.");
  }

  if (!order.parentId) {
    throw new ApiError(403, "Sellers can only view child orders.");
  }

  const sellerItems = order.items.filter((item) => item.sellerId === sellerId);
  if (sellerItems.length === 0) {
    throw new ApiError(403, "You do not have permission to view this order.");
  }

  const sellerSubTotal = Number(
    sellerItems.reduce((acc, item) => acc + item.subtotal, 0).toFixed(2)
  );

  return {
    ...order,
    items: sellerItems,
    sellerSubTotal,
  };
};

const updateParentOrderStatus = async (parentOrderId: string) => {
  const children = await prisma.order.findMany({
    where: { parentId: parentOrderId },
    select: { status: true },
  });

  if (children.length === 0) return;

  const statuses = children.map((c) => c.status);
  let parentStatus: OrderStatus = OrderStatus.CONFIRMED;

  if (statuses.every((s) => s === OrderStatus.COMPLETED)) {
    parentStatus = OrderStatus.COMPLETED;
  } else if (statuses.every((s) => s === OrderStatus.DELIVERED || s === OrderStatus.COMPLETED)) {
    parentStatus = OrderStatus.DELIVERED;
  } else if (statuses.every((s) => s === OrderStatus.CANCELLED)) {
    parentStatus = OrderStatus.CANCELLED;
  } else if (statuses.every((s) => s === OrderStatus.FAILED)) {
    parentStatus = OrderStatus.FAILED;
  } else if (statuses.some((s) => s === OrderStatus.OUT_FOR_DELIVERY)) {
    parentStatus = OrderStatus.OUT_FOR_DELIVERY;
  } else if (statuses.some((s) => s === OrderStatus.PREPARING)) {
    parentStatus = OrderStatus.PREPARING;
  } else if (statuses.some((s) => s === OrderStatus.ACCEPTED)) {
    parentStatus = OrderStatus.ACCEPTED;
  }

  await prisma.order.update({
    where: { id: parentOrderId },
    data: { status: parentStatus },
  });
};

const updateOrderStatus = async (sellerId: string, orderId: string, newStatus: OrderStatus) => {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
  });

  if (!order) {
    throw new ApiError(404, "Order not found.");
  }

  if (!order.parentId) {
    throw new ApiError(403, "Sellers can only manage child orders.");
  }

  // Fix: Lock on the parent tree ID so concurrent seller status update and
  // admin payment update cannot conflict on the same documents.
  const treeLockKey = `lock:order:tree:${order.parentId}`;
  const lockAcquired = await redis.set(treeLockKey, "locked", "NX" as any, "PX" as any, 5000 as any);
  if (!lockAcquired) {
    throw new ApiError(409, "Another update request for this order is in progress.");
  }

  try {
    const sellerItems = order.items.filter((item) => item.sellerId === sellerId);
    if (sellerItems.length === 0) {
      throw new ApiError(403, "You do not have permission to update this order.");
    }

    // Fix: Added FAILED and CANCELLED as valid exits from OUT_FOR_DELIVERY
    // to handle COD delivery failures (customer unreachable, refused payment, etc.).
    // Added CANCELLED from PREPARING to handle pre-dispatch cancellations.
    const transitionMap: Record<OrderStatus, OrderStatus[]> = {
      [OrderStatus.PENDING_PAYMENT]: [OrderStatus.CONFIRMED, OrderStatus.CANCELLED],
      [OrderStatus.CONFIRMED]: [OrderStatus.ACCEPTED, OrderStatus.CANCELLED],
      [OrderStatus.ACCEPTED]: [OrderStatus.PREPARING, OrderStatus.CANCELLED],
      [OrderStatus.PREPARING]: [OrderStatus.OUT_FOR_DELIVERY, OrderStatus.CANCELLED],
      [OrderStatus.OUT_FOR_DELIVERY]: [OrderStatus.DELIVERED, OrderStatus.FAILED, OrderStatus.CANCELLED],
      [OrderStatus.DELIVERED]: [],
      [OrderStatus.COMPLETED]: [],
      [OrderStatus.CANCELLED]: [],
      [OrderStatus.FAILED]: [],
    };

    const allowedTransitions = transitionMap[order.status] || [];
    if (!allowedTransitions.includes(newStatus)) {
      throw new ApiError(400, `Invalid status transition from ${order.status} to ${newStatus}.`);
    }

    const updateData: any = {
      status: newStatus,
    };

    // If order payment status is PAID (e.g. cash collected), DELIVERED auto-completes
    if (newStatus === OrderStatus.DELIVERED && order.paymentStatus === PaymentStatus.PAID) {
      updateData.status = OrderStatus.COMPLETED;
    }

    const updatedOrder = await prisma.order.update({
      where: { id: orderId },
      data: updateData,
    });

    await updateParentOrderStatus(order.parentId);

    // Fire-and-forget: Create outbox event for status update notification to buyer
    try {
      const outboxEvent = await prisma.outboxEvent.create({
        data: {
          eventType: OutboxEventType.ORDER_STATUS_UPDATED,
          payload: {
            childOrderId: updatedOrder.id,
            childOrderNumber: updatedOrder.orderNumber,
            parentOrderId: order.parentId,
            newStatus: updatedOrder.status,
            buyerId: updatedOrder.userId,
          },
          status: OutboxStatus.PENDING,
        },
      });
      await outboxQueue.add(OutboxEventType.ORDER_STATUS_UPDATED, { outboxId: outboxEvent.id });
    } catch (notifErr) {
      console.error("Failed to queue order status update notification:", notifErr);
    }

    return updatedOrder;
  } finally {
    await redis.del(treeLockKey);
  }
};

const getAllOrders = async (query: Record<string, any>) => {
  const page = Number(query.page) || 1;
  const limit = Number(query.limit) || 10;
  const skip = (page - 1) * limit;

  const { search, status, paymentMethod, paymentStatus } = query;

  const whereCondition: any = {
    parentId: null, // Admin list shows Parent Orders by default
  };

  if (status) whereCondition.status = status as OrderStatus;
  if (paymentMethod) whereCondition.paymentMethod = paymentMethod as PaymentMethod;
  if (paymentStatus) whereCondition.paymentStatus = paymentStatus as PaymentStatus;

  if (search) {
    whereCondition.OR = [
      { orderNumber: { contains: search, mode: "insensitive" } },
      { recipientName: { contains: search, mode: "insensitive" } },
      { contactPhone: { contains: search, mode: "insensitive" } },
    ];
  }

  const [data, total] = await Promise.all([
    prisma.order.findMany({
      where: whereCondition,
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
      include: {
        childOrders: true,
      },
    }),
    prisma.order.count({ where: whereCondition }),
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

const getAdminOrderById = async (orderId: string) => {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      childOrders: true,
    },
  });

  if (!order) {
    throw new ApiError(404, "Order not found.");
  }

  return order;
};

const adminUpdatePaymentStatus = async (orderId: string, payload: { paymentStatus: PaymentStatus }) => {
  // Fix: Use the same tree-level lock key as updateOrderStatus to prevent
  // concurrent seller status + admin payment updates from deadlocking.
  const lockKey = `lock:order:tree:${orderId}`;
  const lockAcquired = await redis.set(lockKey, "locked", "NX" as any, "PX" as any, 5000 as any);
  if (!lockAcquired) {
    throw new ApiError(409, "Another update request for this order is in progress.");
  }

  try {
    const parentOrder = await prisma.order.findUnique({
      where: { id: orderId },
    });

    if (!parentOrder) {
      throw new ApiError(404, "Parent order not found.");
    }

    if (parentOrder.parentId) {
      throw new ApiError(400, "Please update the payment status of the Parent Order directly.");
    }

    const newPaymentStatus = payload.paymentStatus;

    const result = await prisma.$transaction(async (tx) => {
      const parentUpdateData: any = {
        paymentStatus: newPaymentStatus,
      };
      if (newPaymentStatus === PaymentStatus.PAID && parentOrder.status === OrderStatus.DELIVERED) {
        parentUpdateData.status = OrderStatus.COMPLETED;
      }

      const updatedParent = await tx.order.update({
        where: { id: orderId },
        data: parentUpdateData,
      });

      const children = await tx.order.findMany({
        where: { parentId: orderId },
      });

      for (const child of children) {
        const childUpdateData: any = {
          paymentStatus: newPaymentStatus,
        };
        if (newPaymentStatus === PaymentStatus.PAID && child.status === OrderStatus.DELIVERED) {
          childUpdateData.status = OrderStatus.COMPLETED;
        }

        await tx.order.update({
          where: { id: child.id },
          data: childUpdateData,
        });
      }

      return updatedParent;
    });

    return result;
  } finally {
    await redis.del(lockKey);
  }
};

const getOrderStatistics = async () => {
  // Fix: Use aggregate() instead of findMany() + JS reduce() to compute revenue.
  // findMany() loads every paid order's totalPrice into Node.js heap memory,
  // causing OOM crashes at scale. aggregate() delegates the sum to MongoDB.
  const [totalOrders, revenueAgg, statusGroups, methodGroups, paymentStatusGroups] = await Promise.all([
    prisma.order.count({ where: { parentId: null } }),
    prisma.order.aggregate({
      where: { parentId: null, paymentStatus: PaymentStatus.PAID },
      _sum: { totalPrice: true },
    }),
    prisma.order.groupBy({
      by: ["status"],
      where: { parentId: null },
      _count: true,
    }),
    prisma.order.groupBy({
      by: ["paymentMethod"],
      where: { parentId: null },
      _count: true,
    }),
    prisma.order.groupBy({
      by: ["paymentStatus"],
      where: { parentId: null },
      _count: true,
    }),
  ]);

  const totalRevenue = Number((revenueAgg._sum.totalPrice ?? 0).toFixed(2));

  const statusStats = statusGroups.reduce((acc: any, curr) => {
    acc[curr.status] = curr._count;
    return acc;
  }, {});

  const methodStats = methodGroups.reduce((acc: any, curr) => {
    acc[curr.paymentMethod] = curr._count;
    return acc;
  }, {});

  const paymentStatusStats = paymentStatusGroups.reduce((acc: any, curr) => {
    acc[curr.paymentStatus] = curr._count;
    return acc;
  }, {});

  return {
    totalOrders,
    totalRevenue,
    byStatus: statusStats,
    byPaymentMethod: methodStats,
    byPaymentStatus: paymentStatusStats,
  };
};

export const OrderService = {
  createOrder,
  getMyOrders,
  getOrderById,
  cancelOrder,
  reorder,
  getSellerOrders,
  getSellerOrderById,
  updateOrderStatus,
  getAllOrders,
  getAdminOrderById,
  adminUpdatePaymentStatus,
  getOrderStatistics,
};
