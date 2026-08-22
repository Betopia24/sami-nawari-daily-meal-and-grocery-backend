import { getMessaging } from "firebase-admin/messaging";
import { prisma } from "../../prisma/prisma";
import { TCreateNotificationPayload } from "./notification.interface";
import ApiError from "../../errors/apiError";

const createNotification = async (payload: TCreateNotificationPayload) => {
  const { userId, title, message, type } = payload;

  const notification = await prisma.notification.create({
    data: {
      userId,
      title,
      message,
      type,
    },
  });

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { fcmToken: true },
  });

  if (user?.fcmToken) {
    try {
      const messagingPayload = {
        notification: {
          title,
          body: message,
        },
        data: {
          type,
          notificationId: notification.id,
        },
        token: user.fcmToken,
      };

      await getMessaging().send(messagingPayload);
      console.log(`Push notification sent successfully to user ${userId}`);
    } catch (error) {
      console.warn("FCM push notification failed (possibly unconfigured firebase credentials):", error);
    }
  }

  return notification;
};

const getMyNotifications = async (userId: string) => {
  const notifications = await prisma.notification.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });
  return notifications;
};

const markAsRead = async (userId: string, notificationId: string) => {
  const notification = await prisma.notification.findUnique({
    where: { id: notificationId },
  });

  if (!notification) {
    throw new ApiError(404, "Notification not found");
  }

  if (notification.userId !== userId) {
    throw new ApiError(403, "Access denied");
  }

  const updated = await prisma.notification.update({
    where: { id: notificationId },
    data: { isRead: true },
  });

  return updated;
};

const markAllAsRead = async (userId: string) => {
  await prisma.notification.updateMany({
    where: { userId, isRead: false },
    data: { isRead: true },
  });
  return { message: "All notifications marked as read" };
};

export const NotificationService = {
  createNotification,
  getMyNotifications,
  markAsRead,
  markAllAsRead,
};
