/* eslint-disable @typescript-eslint/no-explicit-any */
import { Worker } from "bullmq";
import { getMessaging } from "firebase-admin/messaging";
import { prisma } from "../prisma/prisma";
import { NotificationType } from "@prisma/client";
import redis, { redisConnectionConfig } from "../utils/redisClient";

export const fcmWorker = new Worker(
  "fcm-queue",
  async (job) => {
    const { userId, title, message } = job.data;
    const jobId = job.id;
    const idempotencyKey = `idempotency:fcm:${jobId}`;

    console.log(`📱 FCM Worker: Processing job ${jobId} (User: ${userId})`);

    // 1. Idempotency Check
    const isProcessed = await redis.get(idempotencyKey);
    if (isProcessed) {
      console.log(`ℹ️ FCM Worker: Job ${jobId} already successfully processed. Skipping.`);
      return { success: true, reason: "Idempotent skip" };
    }

    // 2. Fetch User FCM Token
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { fcmToken: true, isNotificationEnabled: true },
    });

    if (!user) {
      console.warn(`⚠️ FCM Worker: User ${userId} not found.`);
      return { success: false, reason: "User not found" };
    }

    // Check if user has disabled notifications
    if (user.isNotificationEnabled === false) {
      console.log(`🔕 FCM Worker: User ${userId} has disabled push notifications. Skipping.`);
      return { success: true, reason: "Notifications disabled by user" };
    }

    // 3. Send FCM Push Notification
    if (user.fcmToken) {
      try {
        const messagingPayload = {
          notification: {
            title,
            body: message,
          },
          data: {
            type: NotificationType.ORDER,
          },
          token: user.fcmToken,
        };

        await getMessaging().send(messagingPayload);
        console.log(`✅ FCM Worker: Push notification sent successfully to user ${userId}`);
      } catch (error: any) {
        console.warn("FCM Worker Warning: FCM send failed:", error.message);

        // Auto-clear invalid/expired FCM tokens to avoid future wasted sends
        if (
          error.code === "messaging/registration-token-not-registered" ||
          error.code === "messaging/invalid-argument" ||
          error.code === "messaging/invalid-registration-token"
        ) {
          await prisma.user.update({
            where: { id: userId },
            data: { fcmToken: null },
          });
          console.log(`🧹 Cleared invalid FCM token for user ${userId}`);
        }
        // Do NOT rethrow — invalid tokens should not trigger BullMQ retries
      }
    } else {
      console.log(`ℹ️ FCM Worker: User ${userId} has no active FCM Token. Skipping.`);
    }

    // 4. Mark Job as Done in Redis (Idempotency)
    await redis.set(idempotencyKey, "done", "EX", 86400);

    return { success: true };
  },
  {
    connection: redisConnectionConfig,
    concurrency: 10, // FCM calls are non-blocking I/O — high concurrency is safe
  }
);

fcmWorker.on("completed", (job) => {
  console.log(`✅ FCM Worker Job ${job.id} completed.`);
});

fcmWorker.on("failed", (job, err) => {
  console.error(`❌ FCM Worker Job ${job?.id} failed:`, err);
});
