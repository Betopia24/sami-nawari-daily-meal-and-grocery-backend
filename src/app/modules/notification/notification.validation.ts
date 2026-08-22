import { z } from "zod";
import { NotificationType } from "@prisma/client";

const createNotificationSchema = z.object({
  userId: z.string().min(1, "User ID is required"),
  title: z.string().min(1, "Title is required"),
  message: z.string().min(1, "Message is required"),
  type: z.nativeEnum(NotificationType),
});

export const notificationValidation = {
  createNotificationSchema,
};
