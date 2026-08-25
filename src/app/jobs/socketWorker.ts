import { Worker } from "bullmq";
import { NotificationType } from "@prisma/client";
import { prisma } from "../prisma/prisma";
import redis, { redisConnectionConfig } from "../utils/redisClient";
import { emitToUser } from "../utils/socketHelper";

export const socketWorker = new Worker(
  "socket-queue",
  async (job) => {
    const { userId, title, message } = job.data;
    const jobId = job.id;
    const idempotencyKey = `idempotency:socket:${jobId}`;

    console.log(`🔌 Socket Worker: Processing job ${jobId} (User: ${userId})`);

    // 1. Idempotency Check FIRST (before any DB write)
    // BullMQ jobId is always unique, so this key is a reliable guard against duplicates on retry
    const isProcessed = await redis.get(idempotencyKey);
    if (isProcessed) {
      console.log(`ℹ️ Socket Worker: Job ${jobId} already successfully processed. Skipping.`);
      return { success: true, reason: "Idempotent skip" };
    }

    // 2. Create In-App Notification Log in DB
    const notification = await prisma.notification.create({
      data: {
        userId,
        title,
        message,
        type: NotificationType.ORDER,
      },
    });

    // 3. Mark idempotency key IMMEDIATELY after DB write succeeds
    // This prevents duplicate notifications if the process crashes between steps
    await redis.set(idempotencyKey, "done", "EX", 86400); // 24 hours TTL

    // 4. Emit Real-time Socket Event via SocketHelper (Redis Adapter routes it)
    // This is best-effort — if the user is offline the DB record persists for later retrieval
    try {
      const isSent = emitToUser(userId, "notification::new", notification);
      if (isSent) {
        console.log(`✅ Socket Worker: Emitted socket event to user:${userId}`);
      } else {
        console.log(`ℹ️ Socket Worker: User:${userId} not actively connected. Notification saved to DB.`);
      }
    } catch (socketErr: any) {
      console.warn("Socket Worker Warning: Failed to emit socket event:", socketErr.message);
      // Don't fail the job — notification is already in DB
    }

    return { success: true, notificationId: notification.id };
  },
  {
    connection: redisConnectionConfig,
    concurrency: 10, // Socket notifications are fast — higher concurrency is fine
  }
);

socketWorker.on("completed", (job) => {
  console.log(`✅ Socket Worker Job ${job.id} completed.`);
});

socketWorker.on("failed", (job, err) => {
  console.error(`❌ Socket Worker Job ${job?.id} failed:`, err);
});
