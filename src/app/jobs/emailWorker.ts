import { Worker } from "bullmq";
import { UserRole } from "@prisma/client";
import { prisma } from "../prisma/prisma";
import redis, { redisConnectionConfig } from "../utils/redisClient";
import emailSender from "../utils/emailSender";
import {
  getBuyerOrderEmailTemplate,
  getSellerOrderEmailTemplate,
  getAdminOrderEmailTemplate,
} from "../utils/emailTemplates";

export const emailWorker = new Worker(
  "email-queue",
  async (job) => {
    const { recipientEmail, recipientName, type, orderId } = job.data;
    const jobId = job.id;
    const idempotencyKey = `idempotency:email:${jobId}`;

    console.log(`✉️ Email Worker: Processing job ${jobId} (Type: ${type}, Recipient: ${recipientEmail})`);

    // 1. Idempotency Check
    const isProcessed = await redis.get(idempotencyKey);
    if (isProcessed) {
      console.log(`ℹ️ Email Worker: Job ${jobId} already successfully processed. Skipping.`);
      return { success: true, reason: "Idempotent skip" };
    }

    // 2. Fetch Order Data and Send Email
    let subject = "";
    let htmlContent = "";

    if (type === UserRole.BUYER) {
      const order = await prisma.order.findUnique({
        where: { id: orderId },
      });
      if (!order) throw new Error(`Order ${orderId} not found`);

      subject = `Sami Nawari - Order Confirmed! ${order.orderNumber}`;
      htmlContent = getBuyerOrderEmailTemplate(
        recipientName,
        order.orderNumber,
        order.items,
        order.totalPrice,
        order.deliveryAddress
      );
    } else if (type === UserRole.SELLER) {
      const childOrder = await prisma.order.findUnique({
        where: { id: orderId },
      });
      if (!childOrder) throw new Error(`Child order ${orderId} not found`);

      subject = `Sami Nawari - New Order Received! ${childOrder.orderNumber}`;
      htmlContent = getSellerOrderEmailTemplate(
        recipientName,
        childOrder.orderNumber,
        childOrder.items,
        childOrder.subTotal,
        childOrder.deliveryAddress
      );
    } else if (type === UserRole.ADMIN) {
      const order = await prisma.order.findUnique({
        where: { id: orderId },
        include: { user: true },
      });
      if (!order) throw new Error(`Order ${orderId} not found`);

      subject = `Sami Nawari Admin - New Order Alert ${order.orderNumber}`;
      htmlContent = getAdminOrderEmailTemplate(
        order.orderNumber,
        order.user?.name || "Customer",
        order.items,
        order.totalPrice
      );
    } else {
      throw new Error(`Unknown email notification type: ${type}`);
    }

    // 3. Send Email via NodeMailer
    await emailSender(subject, recipientEmail, htmlContent);

    // 4. Mark Job as Done in Redis (Idempotency) AFTER successful send
    await redis.set(idempotencyKey, "done", "EX", 86400);

    console.log(`✅ Email Worker: Successfully sent email to ${recipientEmail} for job ${jobId}`);
    return { success: true };
  },
  {
    connection: redisConnectionConfig,
    concurrency: 5, // Limit to 5 to avoid overwhelming SMTP server
  }
);

emailWorker.on("completed", (job) => {
  console.log(`✅ Email Worker Job ${job.id} completed.`);
});

emailWorker.on("failed", (job, err) => {
  console.error(`❌ Email Worker Job ${job?.id} failed:`, err);
});
