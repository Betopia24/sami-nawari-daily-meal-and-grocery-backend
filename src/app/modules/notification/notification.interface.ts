import { NotificationType } from "@prisma/client";

export interface TCreateNotificationPayload {
  userId: string;
  title: string;
  message: string;
  type: NotificationType;
}
