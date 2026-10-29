/* eslint-disable @typescript-eslint/no-explicit-any */
import { Request, Response } from "express";
import catchAsync from "../../utils/catchAsync";
import config from "../../config";
import { stripe } from "../../utils/stripe";
import sendResponse from "../../utils/sendResponse";
import { PaymentService } from "./payment.service";
import { getPaymentCancelHtml, getPaymentSuccessHtml } from "../../utils/paymentTemplates";

const handleStripeWebhooksEvent = catchAsync(async (req: Request, res: Response) => {
    const sig = req.headers["stripe-signature"] as string;
    const webSecret = config.stripe.stripeWebHookSecret;

    let event;
    try {
        event = stripe.webhooks.constructEvent(req.body, sig, webSecret as string);
    } catch (err: any) {
        console.log("❌ Webhook signature verification failed:", err.message);
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    const result = await PaymentService.handleStripeWebhooksEvent(event);

    sendResponse(res, {
        statusCode: 200,
        success: true,
        message: "Webhook handled successfully",
        data: result
    });
});

const createCheckoutSession = catchAsync(async (req: Request & { user?: any }, res: Response) => {
    const decodedUser = req.user as any;
    const { orderId } = req.body;

    const result = await PaymentService.createCheckoutSession(decodedUser.userId, orderId, req);

    sendResponse(res, {
        statusCode: 200,
        success: true,
        message: "Stripe Checkout session created successfully",
        data: result,
    });
});

const renderPaymentSuccess = (req: Request, res: Response) => {
    const sessionId = (req.query.session_id as string) || undefined;
    res.setHeader("Content-Type", "text/html");
    res.status(200).send(getPaymentSuccessHtml(sessionId));
};

const renderPaymentCancel = (_req: Request, res: Response) => {
    res.setHeader("Content-Type", "text/html");
    res.status(200).send(getPaymentCancelHtml());
};

export const PaymentController = {
    createCheckoutSession,
    handleStripeWebhooksEvent,
    renderPaymentSuccess,
    renderPaymentCancel,
};
