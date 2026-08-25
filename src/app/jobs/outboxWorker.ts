/* eslint-disable @typescript-eslint/no-explicit-any */
import { Worker } from "bullmq";
import { prisma } from "../prisma/prisma";
import { OutboxEventType, OutboxStatus, UserRole, UserStatus } from "@prisma/client";
import { redisConnectionConfig } from "../utils/redisClient";
import { emailQueue, fcmQueue, socketQueue, outboxQueue } from "./queue";

export const outboxWorker = new Worker(
  "outbox-queue",
  async (job) => {
    console.log(`🤖 Outbox Worker: Processing job ${job.id} (${job.name})`);

    // 1. Handle cron poller to recover missed/pending events
    if (job.name === "outbox-poller") {
      const oneMinuteAgo = new Date(Date.now() - 60000);
      // Pick up PENDING events older than 1 minute AND FAILED events that have
      // exhausted BullMQ retries (attempts >= 5) so they can be re-tried later
      const pendingEvents = await prisma.outboxEvent.findMany({
        where: {
          OR: [
            {
              status: OutboxStatus.PENDING,
              createdAt: { lt: oneMinuteAgo },
            },
            {
              status: OutboxStatus.FAILED,
              attempts: { lt: 5 },
              updatedAt: { lt: new Date(Date.now() - 5 * 60000) }, // wait 5 min before retrying failed
            },
          ],
        },
        take: 20,
      });

      console.log(`🔍 Outbox Cron Poller: Found ${pendingEvents.length} missed/failed event(s)`);

      for (const event of pendingEvents) {
        // Reset to PENDING so the worker can process it again
        await prisma.outboxEvent.update({
          where: { id: event.id },
          data: { status: OutboxStatus.PENDING },
        });
        await outboxQueue.add(OutboxEventType.ORDER_CREATED, { outboxId: event.id });
      }
      return { polled: pendingEvents.length };
    }

    // 2. Handle ORDER_CREATED event processing
    if (job.name === OutboxEventType.ORDER_CREATED) {
      const { outboxId } = job.data;
      const event = await prisma.outboxEvent.findUnique({
        where: { id: outboxId },
      });

      if (!event) {
        console.warn(`⚠️ Outbox event ${outboxId} not found in database.`);
        return { success: false, reason: "Event not found" };
      }

      if (event.status === OutboxStatus.PROCESSED) {
        console.log(`ℹ️ Outbox event ${outboxId} was already processed.`);
        return { success: true, reason: "Already processed" };
      }

      // Reset status to PENDING at the start of each attempt to allow poller re-pickup on final failure
      await prisma.outboxEvent.update({
        where: { id: outboxId },
        data: { status: OutboxStatus.PENDING },
      });

      try {
        const payload = event.payload as any;
        const parentOrderId = payload.id;

        // Fetch parent order with buyer and child orders
        const parentOrder = await prisma.order.findUnique({
          where: { id: parentOrderId },
          include: {
            user: true,
            childOrders: true,
          },
        });

        if (!parentOrder) {
          throw new Error(`Parent order ${parentOrderId} not found in database.`);
        }

        const buyer = parentOrder.user;

        // Collect all unique sellerIds from child orders in one pass
        const sellerIds = [
          ...new Set(
            parentOrder.childOrders
              .map((c) => (c.items[0] as any)?.sellerId)
              .filter(Boolean)
          ),
        ] as string[];

        // Batch fetch all sellers in a single query (fix N+1)
        const sellers = await prisma.user.findMany({
          where: { id: { in: sellerIds } },
        });
        const sellerMap = new Map(sellers.map((s) => [s.id, s]));

        // --- BUYER NOTIFICATIONS ---
        await emailQueue.add(
          "send-email",
          {
            recipientEmail: buyer.email,
            recipientName: buyer.name,
            type: UserRole.BUYER,
            orderId: parentOrder.id,
          },
          { jobId: `email_buyer_${parentOrder.id}` }
        );

        await socketQueue.add(
          "send-socket",
          {
            userId: buyer.id,
            title: "Order Placed Successfully! 🎉",
            message: `Your order ${parentOrder.orderNumber} for $${parentOrder.totalPrice} has been successfully placed.`,
          },
          { jobId: `socket_buyer_${parentOrder.id}` }
        );

        await fcmQueue.add(
          "send-fcm",
          {
            userId: buyer.id,
            title: "Order Placed Successfully! 🎉",
            message: `Your order ${parentOrder.orderNumber} for $${parentOrder.totalPrice} has been successfully placed.`,
          },
          { jobId: `fcm_buyer_${parentOrder.id}` }
        );

        // --- SELLERS NOTIFICATIONS ---
        for (const childOrder of parentOrder.childOrders) {
          const firstItem = childOrder.items[0] as any;
          if (!firstItem) continue;

          const seller = sellerMap.get(firstItem.sellerId);
          if (!seller) {
            console.warn(`⚠️ Seller user ${firstItem.sellerId} not found in database.`);
            continue;
          }

          await emailQueue.add(
            "send-email",
            {
              recipientEmail: seller.email,
              recipientName: seller.name,
              type: UserRole.SELLER,
              orderId: childOrder.id,
            },
            { jobId: `email_seller_${childOrder.id}` }
          );

          await socketQueue.add(
            "send-socket",
            {
              userId: seller.id,
              title: "New Order Received! 🍕",
              message: `You have received a new order ${childOrder.orderNumber} for $${childOrder.totalPrice} to prepare.`,
            },
            { jobId: `socket_seller_${childOrder.id}` }
          );

          await fcmQueue.add(
            "send-fcm",
            {
              userId: seller.id,
              title: "New Order Received! 🍕",
              message: `You have received a new order ${childOrder.orderNumber} for $${childOrder.totalPrice} to prepare.`,
            },
            { jobId: `fcm_seller_${childOrder.id}` }
          );
        }

        // --- ADMIN NOTIFICATIONS ---
        const admins = await prisma.user.findMany({
          where: {
            role: UserRole.ADMIN,
            status: UserStatus.ACTIVE,
          },
          select: { id: true, email: true, name: true },
        });

        for (const admin of admins) {
          await emailQueue.add(
            "send-email",
            {
              recipientEmail: admin.email,
              recipientName: admin.name,
              type: UserRole.ADMIN,
              orderId: parentOrder.id,
            },
            { jobId: `email_admin_${admin.id}_${parentOrder.id}` }
          );
        }

        // Mark event as PROCESSED only after all sub-jobs are enqueued
        await prisma.outboxEvent.update({
          where: { id: outboxId },
          data: {
            status: OutboxStatus.PROCESSED,
            attempts: { increment: 1 },
          },
        });

        console.log(`✅ Outbox Worker: Successfully processed outbox event ${outboxId}`);
        return { success: true };
      } catch (err: any) {
        console.error(`❌ Outbox Worker: Failed to process outbox event ${outboxId}:`, err);

        // Mark FAILED in DB — BullMQ will retry automatically via exponential backoff
        await prisma.outboxEvent.update({
          where: { id: outboxId },
          data: {
            status: OutboxStatus.FAILED,
            error: err.message,
            attempts: { increment: 1 },
          },
        });

        throw err; // Rethrow to trigger BullMQ automatic retry
      }
    }

    // 3. Handle ORDER_STATUS_UPDATED event processing
    if (job.name === OutboxEventType.ORDER_STATUS_UPDATED) {
      const { outboxId } = job.data;
      const event = await prisma.outboxEvent.findUnique({
        where: { id: outboxId },
      });

      if (!event) {
        console.warn(`⚠️ Outbox event ${outboxId} not found.`);
        return { success: false, reason: "Event not found" };
      }

      if (event.status === OutboxStatus.PROCESSED) {
        console.log(`ℹ️ Outbox event ${outboxId} already processed.`);
        return { success: true, reason: "Already processed" };
      }

      await prisma.outboxEvent.update({
        where: { id: outboxId },
        data: { status: OutboxStatus.PENDING },
      });

      try {
        const payload = event.payload as any;
        const { buyerId, childOrderNumber, newStatus } = payload;

        const statusLabels: Record<string, string> = {
          ACCEPTED: "accepted",
          PREPARING: "being prepared",
          OUT_FOR_DELIVERY: "out for delivery",
          DELIVERED: "delivered",
          COMPLETED: "completed",
          CANCELLED: "cancelled",
          FAILED: "failed",
        };
        const statusLabel = statusLabels[newStatus] || newStatus.toLowerCase();
        const title = `Order Update 📦`;
        const message = `Your order ${childOrderNumber} is now ${statusLabel}.`;

        // Notify buyer via Socket (in-app)
        await socketQueue.add(
          "send-socket",
          { userId: buyerId, title, message },
          { jobId: `socket_status_${outboxId}` }
        );

        // Notify buyer via FCM (push notification)
        await fcmQueue.add(
          "send-fcm",
          { userId: buyerId, title, message },
          { jobId: `fcm_status_${outboxId}` }
        );

        await prisma.outboxEvent.update({
          where: { id: outboxId },
          data: { status: OutboxStatus.PROCESSED, attempts: { increment: 1 } },
        });

        console.log(`✅ Outbox Worker: Status update notification queued for buyer ${buyerId}`);
        return { success: true };
      } catch (err: any) {
        console.error(`❌ Outbox Worker: Failed to process status update event ${outboxId}:`, err);

        await prisma.outboxEvent.update({
          where: { id: outboxId },
          data: { status: OutboxStatus.FAILED, error: err.message, attempts: { increment: 1 } },
        });

        throw err;
      }
    }
  },
  {
    connection: redisConnectionConfig,
    concurrency: 5, // Process up to 5 outbox events in parallel
  }
);

outboxWorker.on("completed", (job) => {
  console.log(`✅ Outbox Worker Job ${job.id} completed.`);
});

outboxWorker.on("failed", (job, err) => {
  console.error(`❌ Outbox Worker Job ${job?.id} failed:`, err);
});

// Helper to start the cron scheduler
export const startOutboxScheduler = async () => {
  console.log("⏰ Starting Outbox Resiliency Cron Scheduler...");

  await outboxQueue.upsertJobScheduler(
    "outbox-poller-scheduler",
    {
      pattern: "*/60 * * * * *", // run every 60 seconds
    },
    {
      name: "outbox-poller",
      data: {},
    }
  );
};
