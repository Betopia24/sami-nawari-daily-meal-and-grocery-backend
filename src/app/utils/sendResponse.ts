/* eslint-disable @typescript-eslint/consistent-type-definitions */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { Response } from "express";

type TResponse = {
    statusCode: number;
    success: boolean;
    message: string;
    data?: any;
    meta?: any;
    unreadCount?: number;
    total?: number;
};

const sendResponse = (res: Response, payload: TResponse) => {
    res.status(payload.statusCode).json({
        statusCode: payload.statusCode,
        success: payload.success,
        message: payload.message,
        ...(payload.unreadCount !== undefined && { unreadCount: payload.unreadCount }),
        ...(payload.total !== undefined && { total: payload.total }),
        data: payload.data,
        ...(payload.meta !== undefined && { meta: payload.meta }),
    });
};

export default sendResponse;
