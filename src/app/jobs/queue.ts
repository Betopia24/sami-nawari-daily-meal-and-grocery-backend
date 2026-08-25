import { Queue } from "bullmq";
import { redisConnectionConfig } from "../utils/redisClient";

const connection = redisConnectionConfig;

const defaultJobOptions = {
  attempts: 5,
  backoff: {
    type: "exponential",
    delay: 5000,
  },
  removeOnComplete: true,
  removeOnFail: false,
};

export const outboxQueue = new Queue("outbox-queue", {
  connection,
  defaultJobOptions,
});

export const emailQueue = new Queue("email-queue", {
  connection,
  defaultJobOptions,
});

export const fcmQueue = new Queue("fcm-queue", {
  connection,
  defaultJobOptions,
});

export const socketQueue = new Queue("socket-queue", {
  connection,
  defaultJobOptions,
});
