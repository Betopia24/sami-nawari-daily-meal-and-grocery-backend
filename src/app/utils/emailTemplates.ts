
export const getOtpEmailTemplate = (
  name: string,
  code: string,
  subject: string,
  messageText: string
): string => {
  const currentYear = new Date().getFullYear();
  return `
    <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; padding: 30px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);">
      <div style="text-align: center; margin-bottom: 24px;">
        <h2 style="color: #2e7d32; font-size: 24px; margin: 0; font-weight: 700; letter-spacing: -0.5px;">Sami Nawari</h2>
        <p style="color: #64748b; font-size: 14px; margin: 4px 0 0 0;">Daily Meal & Grocery</p>
      </div>
      <div style="border-top: 3px solid #4caf50; padding-top: 24px;">
        <h3 style="color: #1e293b; font-size: 20px; margin-top: 0; margin-bottom: 16px; text-align: center;">${subject}</h3>
        <p style="color: #334155; font-size: 16px; line-height: 1.6; margin-bottom: 24px;">Hello ${name},</p>
        <p style="color: #334155; font-size: 16px; line-height: 1.6; margin-bottom: 24px;">${messageText}</p>
        <div style="text-align: center; margin: 32px 0;">
          <div style="display: inline-block; font-size: 32px; font-weight: 700; letter-spacing: 6px; color: #1e293b; background-color: #f1f5f9; padding: 12px 32px; border-radius: 8px; border: 1px dashed #cbd5e1;">
            ${code}
          </div>
        </div>
        <p style="color: #64748b; font-size: 14px; line-height: 1.5; text-align: center; margin-top: 32px;">
          This verification code is valid for <strong>5 minutes</strong>. If you did not request this email, please ignore it or contact support.
        </p>
      </div>
      <div style="margin-top: 40px; border-top: 1px solid #e2e8f0; padding-top: 20px; text-align: center;">
        <p style="color: #94a3b8; font-size: 12px; margin: 0;">&copy; ${currentYear} Sami Nawari. All rights reserved.</p>
      </div>
    </div>
  `;
};

export const getSellerStatusEmailTemplate = (
  name: string,
  businessName: string,
  status: "APPROVED" | "REJECTED",
  adminNote?: string | null
): string => {
  const currentYear = new Date().getFullYear();
  const title = status === "APPROVED" ? "Application Approved 🎉" : "Application Rejected ❌";
  const color = status === "APPROVED" ? "#2e7d32" : "#c62828";
  
  const statusMessage = status === "APPROVED"
    ? `Congratulations! Your seller application for <strong>${businessName}</strong> has been approved. You can now log into your account, switch to Seller mode, and start managing your kitchen, foods, and earnings.`
    : `We regret to inform you that your seller application for <strong>${businessName}</strong> has been rejected by the admin.`;
    
  const noteSection = adminNote
    ? `<div style="margin: 24px 0; padding: 16px; background-color: #f8fafc; border-left: 4px solid ${color}; border-radius: 4px;">
         <strong style="color: #1e293b; font-size: 14px; display: block; margin-bottom: 6px;">Reason / Admin Note:</strong>
         <p style="color: #475569; font-size: 14px; margin: 0; line-height: 1.5;">${adminNote}</p>
       </div>`
    : "";

  return `
    <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; padding: 30px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);">
      <div style="text-align: center; margin-bottom: 24px;">
        <h2 style="color: #2e7d32; font-size: 24px; margin: 0; font-weight: 700; letter-spacing: -0.5px;">Sami Nawari</h2>
        <p style="color: #64748b; font-size: 14px; margin: 4px 0 0 0;">Daily Meal & Grocery</p>
      </div>
      <div style="border-top: 3px solid ${color}; padding-top: 24px;">
        <h3 style="color: #1e293b; font-size: 20px; margin-top: 0; margin-bottom: 16px; text-align: center;">${title}</h3>
        <p style="color: #334155; font-size: 16px; line-height: 1.6; margin-bottom: 16px;">Hello ${name},</p>
        <p style="color: #334155; font-size: 16px; line-height: 1.6; margin-bottom: 16px;">${statusMessage}</p>
        ${noteSection}
        <p style="color: #334155; font-size: 16px; line-height: 1.6; margin-top: 24px;">
          Thank you for choosing Sami Nawari.
        </p>
      </div>
      <div style="margin-top: 40px; border-top: 1px solid #e2e8f0; padding-top: 20px; text-align: center;">
        <p style="color: #94a3b8; font-size: 12px; margin: 0;">&copy; ${currentYear} Sami Nawari. All rights reserved.</p>
      </div>
    </div>
  `;
};

export const getGroceryInviteEmailTemplate = (
  invitedEmail: string,
  inviterName: string,
  groceryListName: string,
  role: string
): string => {
  const currentYear = new Date().getFullYear();
  const roleDisplay = role.toUpperCase();
  
  return `
    <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; padding: 30px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);">
      <div style="text-align: center; margin-bottom: 24px;">
        <h2 style="color: #2e7d32; font-size: 24px; margin: 0; font-weight: 700; letter-spacing: -0.5px;">Sami Nawari</h2>
        <p style="color: #64748b; font-size: 14px; margin: 4px 0 0 0;">Daily Meal & Grocery</p>
      </div>
      <div style="border-top: 3px solid #2e7d32; padding-top: 24px;">
        <h3 style="color: #1e293b; font-size: 20px; margin-top: 0; margin-bottom: 16px; text-align: center;">Grocery List Collaboration Invite 🛒</h3>
        <p style="color: #334155; font-size: 16px; line-height: 1.6; margin-bottom: 16px;">Hello,</p>
        <p style="color: #334155; font-size: 16px; line-height: 1.6; margin-bottom: 16px;">
          <strong>${inviterName}</strong> has invited you to collaborate on their grocery list: <strong>"${groceryListName}"</strong> as an <strong>${roleDisplay}</strong>.
        </p>
        <p style="color: #334155; font-size: 16px; line-height: 1.6; margin-bottom: 16px;">
          Please log into your account, navigate to the Grocery section, and accept the pending invitation to join this list.
        </p>
      </div>
      <div style="margin-top: 40px; border-top: 1px solid #e2e8f0; padding-top: 20px; text-align: center;">
        <p style="color: #94a3b8; font-size: 12px; margin: 0;">&copy; ${currentYear} Sami Nawari. All rights reserved.</p>
      </div>
    </div>
  `;
};

