import { NextFunction, Request, Response } from "express";
import httpStatus from "http-status";
import config from "../config";
import ApiError from "../errors/apiError";

export const internalAuth = (req: Request, res: Response, next: NextFunction) => {
  try {
    let token = req.headers.authorization;

    if (!token) {
      throw new ApiError(httpStatus.UNAUTHORIZED, "Internal service authorization token is required!");
    }

    if (typeof token === "string" && token.startsWith("Bearer ")) {
      token = token.split(" ")[1];
    }

    const expectedToken = config.aiService.mainBackendServiceToken;

    if (token !== expectedToken) {
      throw new ApiError(httpStatus.UNAUTHORIZED, "Invalid internal service token!");
    }

    next();
  } catch (error) {
    next(error);
  }
};
