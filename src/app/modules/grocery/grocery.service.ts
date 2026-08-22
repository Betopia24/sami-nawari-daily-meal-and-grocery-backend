/* eslint-disable @typescript-eslint/no-explicit-any */
import { prisma } from "../../prisma/prisma";
import { 
  TCreateGroceryListPayload, 
  TCreateGroceryItemPayload, 
  TUpdateGroceryItemPayload, 
  TInviteMemberPayload 
} from "./grocery.interface";
import { GroceryRole, GroceryInvitationStatus, GroceryItemStatus, NotificationType } from "@prisma/client";
import ApiError from "../../errors/apiError";
import emailSender from "../../utils/emailSender";
import { getGroceryInviteEmailTemplate } from "../../utils/emailTemplates";
import { NotificationService } from "../notification/notification.service";

// Helper: Check membership and return details
const checkMembership = async (groceryListId: string, userId: string) => {
  const member = await prisma.groceryMember.findUnique({
    where: {
      groceryListId_userId: { groceryListId, userId },
    },
    include: {
      groceryList: true,
    },
  });

  if (!member) {
    throw new ApiError(403, "You are not a member of this grocery list");
  }

  return member;
};


const createGroceryList = async (userId: string, payload: TCreateGroceryListPayload) => {
  const result = await prisma.$transaction(async (tx) => {
    const groceryList = await tx.groceryList.create({
      data: {
        name: payload.name,
        description: payload.description,
        creatorId: userId,
      },
    });

    await tx.groceryMember.create({
      data: {
        groceryListId: groceryList.id,
        userId,
        role: GroceryRole.OWNER,
      },
    });

    return groceryList;
  });

  return result;
};


const getAllGroceryLists = async (userId: string, searchTerm?: string) => {
  const whereClause: any = {
    members: {
      some: {
        userId,
      },
    },
  };

  if (searchTerm) {
    whereClause.name = {
      contains: searchTerm,
      mode: "insensitive",
    };
  }

  const lists = await prisma.groceryList.findMany({
    where: whereClause,
    orderBy: { createdAt: "desc" },
    include: {
      members: {
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              profilePicture: true,
            },
          },
        },
      },
      items: true,
    },
  });

  return lists.map((list) => {
    const totalItems = list.items.length;
    const completedItems = list.items.filter((item) => item.status === GroceryItemStatus.COMPLETED).length;
    const pendingItems = totalItems - completedItems;

    return {
      id: list.id,
      name: list.name,
      description: list.description,
      creatorId: list.creatorId,
      createdAt: list.createdAt,
      updatedAt: list.updatedAt,
      members: list.members,
      stats: {
        total: totalItems,
        completed: completedItems,
        pending: pendingItems,
      },
    };
  });
};



const getGroceryListById = async (groceryListId: string, userId: string) => {
  const membership = await checkMembership(groceryListId, userId);

  const listDetails = await prisma.groceryList.findUnique({
    where: { id: groceryListId },
    include: {
      items: {
        orderBy: { createdAt: "desc" },
        include: {
          addedBy: {
            select: { id: true, name: true, email: true },
          },
          completedBy: {
            select: { id: true, name: true, email: true },
          },
        },
      },
      members: {
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              profilePicture: true,
            },
          },
        },
      },
      invitations: {
        where: { status: GroceryInvitationStatus.PENDING },
        include: {
          invitedBy: {
            select: { id: true, name: true, email: true },
          },
        },
      },
    },
  });

  return {
    ...listDetails,
    myRole: membership.role,
  };
};


const updateGroceryList = async (
  groceryListId: string,
  userId: string,
  payload: Partial<TCreateGroceryListPayload>
) => {
  const membership = await checkMembership(groceryListId, userId);

  if (membership.role !== GroceryRole.OWNER) {
    throw new ApiError(403, "Only the list owner can update list settings");
  }

  const updated = await prisma.groceryList.update({
    where: { id: groceryListId },
    data: payload,
  });

  return updated;
};


const deleteGroceryList = async (groceryListId: string, userId: string) => {
  const membership = await checkMembership(groceryListId, userId);

  if (membership.role !== GroceryRole.OWNER) {
    throw new ApiError(403, "Only the list owner can delete the grocery list");
  }

  await prisma.groceryList.delete({
    where: { id: groceryListId },
  });

  return { message: "Grocery list deleted successfully" };
};

const addGroceryItem = async (
  groceryListId: string,
  userId: string,
  payload: TCreateGroceryItemPayload
) => {
  const membership = await checkMembership(groceryListId, userId);

  if (membership.role === GroceryRole.VIEWER) {
    throw new ApiError(403, "Viewers are not allowed to add items");
  }

  const item = await prisma.groceryItem.create({
    data: {
      groceryListId,
      name: payload.name,
      quantity: payload.quantity ?? 1,
      unit: payload.unit,
      category: payload.category,
      priority: payload.priority,
      notes: payload.notes,
      addedById: userId,
    },
    include: {
      addedBy: {
        select: { name: true },
      },
    },
  });

  
  const otherMembers = await prisma.groceryMember.findMany({
    where: {
      groceryListId,
      userId: { not: userId },
    },
  });

  const notifyPromises = otherMembers.map((member) => 
    NotificationService.createNotification({
      userId: member.userId,
      title: "New Item Added 🛒",
      message: `${item.addedBy.name} added "${item.name}" to "${membership.groceryList.name}"`,
      type: NotificationType.GROCERY,
    }).catch(err => console.error("Notification trigger error:", err))
  );
  Promise.all(notifyPromises);

  return item;
};


const updateGroceryItem = async (
  groceryListId: string,
  itemId: string,
  userId: string,
  payload: TUpdateGroceryItemPayload
) => {
  const membership = await checkMembership(groceryListId, userId);

  if (membership.role === GroceryRole.VIEWER) {
    throw new ApiError(403, "Viewers are not allowed to edit items");
  }

  const item = await prisma.groceryItem.findFirst({
    where: { id: itemId, groceryListId },
  });

  if (!item) {
    throw new ApiError(404, "Grocery item not found in this list");
  }

  const updateData: any = { ...payload };

  // Set completedById based on status change
  if (payload.status === "COMPLETED" && item.status !== GroceryItemStatus.COMPLETED) {
    updateData.completedById = userId;
  } else if (payload.status === "PENDING" && item.status !== GroceryItemStatus.PENDING) {
    updateData.completedById = null;
  }

  const updatedItem = await prisma.groceryItem.update({
    where: { id: itemId },
    data: updateData,
    include: {
      addedBy: { select: { name: true } },
    },
  });

  // If item completed, notify other members asynchronously
  if (payload.status === "COMPLETED" && item.status !== GroceryItemStatus.COMPLETED) {
    const updater = await prisma.user.findUnique({
      where: { id: userId },
      select: { name: true },
    });

    const otherMembers = await prisma.groceryMember.findMany({
      where: {
        groceryListId,
        userId: { not: userId },
      },
    });

    const notifyPromises = otherMembers.map((member) => 
      NotificationService.createNotification({
        userId: member.userId,
        title: "Grocery Item Completed ✅",
        message: `${updater?.name || "Someone"} marked "${updatedItem.name}" as completed in "${membership.groceryList.name}"`,
        type: NotificationType.GROCERY,
      }).catch(err => console.error("Notification trigger error:", err))
    );
    Promise.all(notifyPromises);
  }

  return updatedItem;
};


const deleteGroceryItem = async (groceryListId: string, itemId: string, userId: string) => {
  const membership = await checkMembership(groceryListId, userId);

  if (membership.role === GroceryRole.VIEWER) {
    throw new ApiError(403, "Viewers are not allowed to delete items");
  }

  const item = await prisma.groceryItem.findFirst({
    where: { id: itemId, groceryListId },
  });

  if (!item) {
    throw new ApiError(404, "Grocery item not found in this list");
  }

  await prisma.groceryItem.delete({
    where: { id: itemId },
  });

  return { message: "Grocery item deleted successfully" };
};


const inviteMember = async (groceryListId: string, userId: string, payload: TInviteMemberPayload) => {
  const membership = await checkMembership(groceryListId, userId);

  if (membership.role !== GroceryRole.OWNER) {
    throw new ApiError(403, "Only the list owner can invite new members");
  }

  const invitedEmail = payload.email.trim().toLowerCase();

  // Check if already a member
  const existingMember = await prisma.groceryMember.findFirst({
    where: {
      groceryListId,
      user: {
        email: invitedEmail,
      },
    },
  });

  if (existingMember) {
    throw new ApiError(400, "This user is already a member of this list");
  }

  // Check if a pending invitation exists
  const existingInvite = await prisma.groceryInvitation.findFirst({
    where: {
      groceryListId,
      email: invitedEmail,
      status: GroceryInvitationStatus.PENDING,
    },
  });

  if (existingInvite) {
    throw new ApiError(400, "A pending invitation already exists for this email");
  }

  const inviter = await prisma.user.findUnique({
    where: { id: userId },
    select: { name: true },
  });

  // Create the invitation
  const invitation = await prisma.groceryInvitation.create({
    data: {
      groceryListId,
      email: invitedEmail,
      role: payload.role || GroceryRole.VIEWER,
      invitedById: userId,
    },
  });

  // Trigger Notifications asynchronously
  // Check if invited user exists in system
  const targetUser = await prisma.user.findUnique({
    where: { email: invitedEmail },
  });

  // 1. Email Invite
  const htmlContent = getGroceryInviteEmailTemplate(
    invitedEmail,
    inviter?.name || "A collaborator",
    membership.groceryList.name,
    invitation.role
  );
  emailSender(
    `Collab Invite: Join "${membership.groceryList.name}" on Sami Nawari`,
    invitedEmail,
    htmlContent
  ).catch((err) => console.error("Email send error:", err));

  // 2. In-App & Push notifications if user exists
  if (targetUser) {
    NotificationService.createNotification({
      userId: targetUser.id,
      title: "Grocery Collab Invite 🛒",
      message: `${inviter?.name || "A collaborator"} invited you to join "${membership.groceryList.name}" as an ${invitation.role}`,
      type: NotificationType.GROCERY,
    }).catch(err => console.error("Collab notification trigger error:", err));
  }

  return invitation;
};


const getMyInvitations = async (email: string) => {
  const invitations = await prisma.groceryInvitation.findMany({
    where: {
      email: email.trim().toLowerCase(),
      status: GroceryInvitationStatus.PENDING,
    },
    include: {
      groceryList: {
        select: {
          name: true,
          description: true,
        },
      },
      invitedBy: {
        select: {
          name: true,
          email: true,
        },
      },
    },
  });

  return invitations;
};


const respondInvitation = async (
  invitationId: string,
  userId: string,
  userEmail: string,
  status: "ACCEPTED" | "DECLINED"
) => {
  const invitation = await prisma.groceryInvitation.findUnique({
    where: { id: invitationId },
    include: {
      groceryList: true,
    },
  });

  if (!invitation) {
    throw new ApiError(404, "Invitation not found");
  }

  if (invitation.email !== userEmail.trim().toLowerCase()) {
    throw new ApiError(403, "Access denied. This invitation is for a different user");
  }

  if (invitation.status !== GroceryInvitationStatus.PENDING) {
    throw new ApiError(400, "Invitation has already been responded to");
  }

  const responder = await prisma.user.findUnique({
    where: { id: userId },
    select: { name: true },
  });

  if (status === "ACCEPTED") {
    await prisma.$transaction(async (tx) => {
      // 1. Update invite status
      await tx.groceryInvitation.update({
        where: { id: invitationId },
        data: { status: GroceryInvitationStatus.ACCEPTED },
      });

      // 2. Create membership
      await tx.groceryMember.create({
        data: {
          groceryListId: invitation.groceryListId,
          userId,
          role: invitation.role,
        },
      });

      // 3. Notify the inviter
      await NotificationService.createNotification({
        userId: invitation.invitedById,
        title: "Invitation Accepted 🎉",
        message: `${responder?.name || "A user"} accepted your invitation to join "${invitation.groceryList.name}"`,
        type: NotificationType.GROCERY,
      });
    });
  } else {
    // Declined invitation
    await prisma.groceryInvitation.update({
      where: { id: invitationId },
      data: { status: GroceryInvitationStatus.DECLINED },
    });

    // Notify the inviter
    await NotificationService.createNotification({
      userId: invitation.invitedById,
      title: "Invitation Declined ❌",
      message: `${responder?.name || "A user"} declined your invitation to join "${invitation.groceryList.name}"`,
      type: NotificationType.GROCERY,
    }).catch(err => console.error("Notification error:", err));
  }

  return { message: `Invitation ${status.toLowerCase()} successfully` };
};

const updateMemberRole = async (
  groceryListId: string,
  memberId: string,
  userId: string,
  newRole: GroceryRole
) => {
  const membership = await checkMembership(groceryListId, userId);

  if (membership.role !== GroceryRole.OWNER) {
    throw new ApiError(403, "Only the list owner can change member permissions");
  }

  const memberToChange = await prisma.groceryMember.findUnique({
    where: { id: memberId },
  });

  if (!memberToChange || memberToChange.groceryListId !== groceryListId) {
    throw new ApiError(404, "Member not found in this grocery list");
  }

  // Prevent modifying yourself
  if (memberToChange.userId === userId) {
    throw new ApiError(400, "You cannot modify your own permission level");
  }

  const updatedMember = await prisma.groceryMember.update({
    where: { id: memberId },
    data: { role: newRole },
  });

  return updatedMember;
};

const removeMember = async (groceryListId: string, memberId: string, userId: string) => {
  const membership = await checkMembership(groceryListId, userId);

  const memberToRemove = await prisma.groceryMember.findUnique({
    where: { id: memberId },
  });

  if (!memberToRemove || memberToRemove.groceryListId !== groceryListId) {
    throw new ApiError(404, "Member not found in this grocery list");
  }

  const isLeaving = memberToRemove.userId === userId;

  if (isLeaving) {
    // If owner is leaving, check if they are the only owner
    if (memberToRemove.role === GroceryRole.OWNER) {
      const otherOwners = await prisma.groceryMember.count({
        where: {
          groceryListId,
          role: GroceryRole.OWNER,
          userId: { not: userId },
        },
      });

      if (otherOwners === 0) {
        throw new ApiError(
          400,
          "You are the only owner of this list. Please transfer ownership or delete the list instead"
        );
      }
    }
  } else {
    // If removing someone else, actor must be OWNER
    if (membership.role !== GroceryRole.OWNER) {
      throw new ApiError(403, "Only owners are allowed to remove members");
    }
  }

  await prisma.groceryMember.delete({
    where: { id: memberId },
  });

  return { message: isLeaving ? "Left grocery list successfully" : "Member removed successfully" };
};

export const GroceryService = {
  createGroceryList,
  getAllGroceryLists,
  getGroceryListById,
  updateGroceryList,
  deleteGroceryList,
  addGroceryItem,
  updateGroceryItem,
  deleteGroceryItem,
  inviteMember,
  getMyInvitations,
  respondInvitation,
  updateMemberRole,
  removeMember,
};
