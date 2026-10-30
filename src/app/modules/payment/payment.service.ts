import Stripe from "stripe";
import { OrderStatus, PaymentStatus } from "@prisma/client";
import { Request } from "express";
import { prisma } from "../../prisma/prisma";
import ApiError from "../../errors/apiError";
import config from "../../config";
import { stripe } from "../../utils/stripe";
import emailSender from "../../utils/emailSender";

const createCheckoutSession = async (userId: string, orderId: string, req?: Request) => {
  // Performance optimization: select only required order and user fields
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      userId: true,
      items: true,
      deliveryFee: true,
      paymentStatus: true,
      user: {
        select: {
          email: true,
        },
      },
    },
  });

  if (!order) {
    throw new ApiError(404, "Order not found");
  }

  if (order.userId !== userId) {
    throw new ApiError(403, "You do not have permission to pay for this order");
  }

  if (order.paymentStatus === PaymentStatus.PAID) {
    throw new ApiError(400, "This order has already been paid");
  }

  // Determine line items
  const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = order.items.map((item) => ({
    price_data: {
      currency: "usd",
      product_data: {
        name: item.foodName,
      },
      unit_amount: Math.round(item.unitPrice * 100),
    },
    quantity: item.quantity,
  }));

  if (order.deliveryFee > 0) {
    lineItems.push({
      price_data: {
        currency: "usd",
        product_data: {
          name: "Delivery Fee",
        },
        unit_amount: Math.round(order.deliveryFee * 100),
      },
      quantity: 1,
    });
  }

  // Identify seller accounts
  const sellerIds = [...new Set(order.items.map((item) => item.sellerId).filter((id): id is string => Boolean(id)))];

  // Resolve base URL for backend payment callback routes
  let backendOrigin = config.backendUrl;
  if (!backendOrigin && req) {
    const protocol = req.protocol || "http";
    const host = req.get("host");
    if (host) {
      backendOrigin = `${protocol}://${host}`;
    }
  }
  if (!backendOrigin) {
    backendOrigin = `http://localhost:${config.port || 5478}`;
  }

  const successUrl = `${backendOrigin}/api/v1/payments/success?session_id={CHECKOUT_SESSION_ID}`;
  const cancelUrl = `${backendOrigin}/api/v1/payments/cancel`;

  const sessionParams: Stripe.Checkout.SessionCreateParams = {
    payment_method_types: ["card"],
    mode: "payment",
    customer_email: order.user?.email,
    line_items: lineItems,
    metadata: {
      orderId: order.id,
      userId: order.userId,
      isSingleSeller: sellerIds.length === 1 ? "true" : "false",
      sellerId: sellerIds[0] || "",
    },
    success_url: successUrl,
    cancel_url: cancelUrl,
  };

  if (sellerIds.length === 1) {
    const sellerProfile = await prisma.sellerProfile.findUnique({
      where: { userId: sellerIds[0] },
      select: {
        stripeAccountId: true,
        stripeChargesEnabled: true,
      },
    });

    if (sellerProfile?.stripeAccountId && sellerProfile.stripeChargesEnabled) {
      sessionParams.payment_intent_data = {
        transfer_data: {
          destination: sellerProfile.stripeAccountId,
        },
        metadata: {
          orderId: order.id,
          userId: order.userId,
          sellerId: sellerIds[0],
        },
      };
    }
  }

  const session = await stripe.checkout.sessions.create(sessionParams);

  return {
    url: session.url,
    sessionId: session.id,
  };
};

const handleOrderPaymentSuccess = async (orderId: string, paymentIntentId?: string) => {
  const parentOrder = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      childOrders: true,
      user: {
        select: {
          name: true,
          email: true,
        },
      },
    },
  });

  if (!parentOrder || parentOrder.paymentStatus === PaymentStatus.PAID) {
    return;
  }

  // Update parent order and child orders in a transaction
  await prisma.$transaction(async (tx) => {
    const parentUpdateData: any = {
      paymentStatus: PaymentStatus.PAID,
    };
    if (parentOrder.status === OrderStatus.DELIVERED) {
      parentUpdateData.status = OrderStatus.COMPLETED;
    }

    await tx.order.update({
      where: { id: orderId },
      data: parentUpdateData,
    });

    const children = await tx.order.findMany({
      where: { parentId: orderId },
    });

    for (const child of children) {
      const childUpdateData: any = {
        paymentStatus: PaymentStatus.PAID,
      };
      if (child.status === OrderStatus.DELIVERED) {
        childUpdateData.status = OrderStatus.COMPLETED;
      }

      await tx.order.update({
        where: { id: child.id },
        data: childUpdateData,
      });
    }
  });

  // If multi-seller order and paymentIntent exists, transfer shares to respective sellers
  const sellerIds = [...new Set(parentOrder.items.map((item) => item.sellerId))];
  if (sellerIds.length > 1 && paymentIntentId) {
    const children = await prisma.order.findMany({
      where: { parentId: orderId },
    });

    for (const child of children) {
      const childSellerId = child.items[0]?.sellerId;
      if (!childSellerId) continue;

      const sellerProfile = await prisma.sellerProfile.findUnique({
        where: { userId: childSellerId },
      });

      if (sellerProfile?.stripeAccountId && sellerProfile.stripePayoutsEnabled) {
        try {
          const transferAmount = Math.round(child.totalPrice * 100);
          await stripe.transfers.create({
            amount: transferAmount,
            currency: "usd",
            destination: sellerProfile.stripeAccountId,
            description: `Payment for Child Order ${child.orderNumber} (Parent: ${parentOrder.orderNumber})`,
            metadata: {
              orderId: child.id,
              parentOrderId: parentOrder.id,
            },
          });
          console.log(` Transferred $${child.totalPrice} to seller ${sellerProfile.businessName} (${sellerProfile.stripeAccountId})`);
        } catch (transferErr) {
          console.error(` Failed to transfer to seller ${childSellerId}:`, transferErr);
        }
      }
    }
  }

  // Send confirmation email to buyer
  if (parentOrder.user?.email) {
    emailSender(
      "Payment Successful 🎉",
      parentOrder.user.email,
      `
      <div style="font-family: Arial, sans-serif; padding: 20px;">
        <h2 style="color: green;">✅ Payment Confirmed</h2>
        <p>Hi ${parentOrder.user.name || "Customer"},</p>
        <p>Your payment for Order #${parentOrder.orderNumber} has been successfully completed. 🎉</p>
        <p><strong>Amount:</strong> $${parentOrder.totalPrice} USD</p>
        <p>Thank you for your purchase!</p>
        <br/>
        <p style="font-size: 12px; color: gray;">
          If you have any questions, feel free to contact us.
        </p>
      </div>
    `
    ).catch((err) => {
      console.error("Failed to send payment email:", err);
    });
  }
};

const handleStripeWebhooksEvent = async (event: Stripe.Event) => {
  switch (event.type) {
    // 1. Seller Stripe Connect Account Updates
    case "account.updated": {
      const account = event.data.object as Stripe.Account;
      if (account.id) {
        await prisma.sellerProfile.updateMany({
          where: { stripeAccountId: account.id },
          data: {
            stripeChargesEnabled: account.charges_enabled ?? false,
            stripePayoutsEnabled: account.payouts_enabled ?? false,
            stripeOnboardingCompleted: account.details_submitted ?? false,
          },
        });
        console.log(` Updated seller profile for stripe account ${account.id}`);
      }
      break;
    }

    // 2. Checkout Session Completed
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const orderId = session.metadata?.orderId;
      const paymentIntentId = session.payment_intent as string;

      if (orderId) {
        await handleOrderPaymentSuccess(orderId, paymentIntentId);
      }
      break;
    }

    // 3. Payment Intent Succeeded
    case "payment_intent.succeeded": {
      const paymentIntent = event.data.object as Stripe.PaymentIntent;
      const orderId = paymentIntent.metadata?.orderId;

      if (orderId) {
        await handleOrderPaymentSuccess(orderId, paymentIntent.id);
      }
      break;
    }

    default:
      console.log(`Unhandled event type: ${event.type}`);
  }

  return { received: true };
};

export const PaymentService = {
  createCheckoutSession,
  handleStripeWebhooksEvent,
};
