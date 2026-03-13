import { prisma } from "../config/database.js";
import { NotificationType } from "../generated/prisma";

export interface CreateNotificationParams {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  data?: any;
}

export async function createNotification(params: CreateNotificationParams) {
  try {
    console.log("Creating notification with params:", params);
    const result = await prisma.notification.create({
      data: params,
    });
    console.log("Notification created successfully:", result.id);
    return result;
  } catch (error) {
    console.error("Error creating notification:", error);
    throw error;
  }
}

export async function getUserNotifications(userId: string, limit = 20) {
  try {
    console.log(`Fetching notifications for user: ${userId}, limit: ${limit}`);
    const notifications = await prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: limit,
    });
    console.log(
      `Found ${notifications.length} notifications for user ${userId}`,
    );
    return notifications;
  } catch (error) {
    console.error("Error fetching notifications:", error);
    throw error;
  }
}

export async function markNotificationAsRead(
  notificationId: string,
  userId: string,
) {
  return prisma.notification.update({
    where: {
      id: notificationId,
      userId, // Ensure user can only mark their own notifications as read
    },
    data: { read: true },
  });
}

export async function markAllNotificationsAsRead(userId: string) {
  return prisma.notification.updateMany({
    where: {
      userId,
      read: false,
    },
    data: { read: true },
  });
}

export async function getUnreadNotificationCount(userId: string) {
  try {
    console.log(`Getting unread count for user: ${userId}`);
    const count = await prisma.notification.count({
      where: {
        userId,
        read: false,
      },
    });
    console.log(`User ${userId} has ${count} unread notifications`);
    return count;
  } catch (error) {
    console.error("Error getting unread count:", error);
    throw error;
  }
}

// Notification creation helpers for different events
export async function notifyComplaintStatusChange(
  userId: string,
  complaintTitle: string,
  oldStatus: string,
  newStatus: string,
  complaintId: string,
) {
  const statusMessages = {
    ASSIGNED: "has been assigned to a faculty member",
    IN_PROGRESS: "is now being worked on",
    RESOLVED: "has been resolved",
    CLOSED: "has been closed",
  };

  const message =
    statusMessages[newStatus as keyof typeof statusMessages] ||
    "status has been updated";

  await createNotification({
    userId,
    type: "COMPLAINT_STATUS_UPDATE",
    title: "Complaint Status Updated",
    message: `Your complaint "${complaintTitle}" ${message}`,
    data: { complaintId, oldStatus, newStatus },
  });
}

export async function notifyComplaintAssignment(
  facultyUserId: string,
  complaintTitle: string,
  complaintId: string,
) {
  await createNotification({
    userId: facultyUserId,
    type: "COMPLAINT_ASSIGNED",
    title: "New Complaint Assigned",
    message: `You have been assigned a new complaint: "${complaintTitle}"`,
    data: { complaintId },
  });
}

export async function notifyDoubtAnswer(
  questionerId: string,
  doubtTitle: string,
  answererName: string,
  doubtId: string,
) {
  await createNotification({
    userId: questionerId,
    type: "DOUBT_ANSWER",
    title: "New Answer to Your Doubt",
    message: `${answererName} answered your doubt: "${doubtTitle}"`,
    data: { doubtId },
  });
}

export async function notifyAnswerUpvote(
  answererId: string,
  doubtTitle: string,
  doubtId: string,
  answerId: string,
) {
  await createNotification({
    userId: answererId,
    type: "ANSWER_UPVOTED",
    title: "Your Answer Got an Upvote!",
    message: `Your answer to "${doubtTitle}" received an upvote`,
    data: { doubtId, answerId },
  });
}
