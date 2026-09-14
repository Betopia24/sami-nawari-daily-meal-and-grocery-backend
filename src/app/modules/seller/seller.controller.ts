/* eslint-disable @typescript-eslint/no-explicit-any */
import { Request, Response } from "express";
import catchAsync from "../../utils/catchAsync";
import sendResponse from "../../utils/sendResponse";
import { fileUpload } from "../../utils/fileUpload";
import { SellerService } from "./seller.service";
import { sellerValidation } from "./seller.validation";


const submitSellerRequest = catchAsync(async (req: Request & { user?: any }, res: Response) => {
  const decodedUser = req.user as any;
  let payload = req.body;
  if (req.body.data) {
    payload = JSON.parse(req.body.data);
  }
  if (req.file) {
    const uploadResult = await fileUpload.uploadToCloudinary(req.file);
    if (uploadResult && uploadResult.secure_url) {
      payload.governmentId = uploadResult.secure_url;
    }
  }

  if (typeof payload.cuisineTypes === 'string') {
    payload.cuisineTypes = JSON.parse(payload.cuisineTypes);
  }
  if (typeof payload.workingHours === 'string') {
    payload.workingHours = JSON.parse(payload.workingHours);
  }

  if (payload.latitude !== undefined) {
    payload.latitude = Number(payload.latitude);
  }
  if (payload.longitude !== undefined) {
    payload.longitude = Number(payload.longitude);
  }

  const validatedData = await sellerValidation.submitSellerRequestSchema.parseAsync(payload);

  const result = await SellerService.submitSellerRequest(decodedUser.userId, validatedData);

  sendResponse(res, {
    statusCode: 201,
    success: true,
    message: "Seller application submitted successfully. Please wait for admin approval.",
    data: result,
  });
});


const getMySellerProfile = catchAsync(async (req: Request & { user?: any }, res: Response) => {
  const decodedUser = req.user as any;

  const result = await SellerService.getMySellerProfile(decodedUser.userId);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Seller profile retrieved successfully",
    data: result,
  });
});


const updateSellerProfile = catchAsync(async (req: Request & { user?: any }, res: Response) => {
  const decodedUser = req.user as any;
  let payload = req.body;

  if (req.body.data) {
    payload = JSON.parse(req.body.data);
  }

  if (req.file) {
    const uploadResult = await fileUpload.uploadToCloudinary(req.file);
    if (uploadResult && uploadResult.secure_url) {
      payload.profilePicture = uploadResult.secure_url;
    }
  }

  if (typeof payload.cuisineTypes === 'string') {
    payload.cuisineTypes = JSON.parse(payload.cuisineTypes);
  }
  if (typeof payload.workingHours === 'string') {
    payload.workingHours = JSON.parse(payload.workingHours);
  }

  if (payload.latitude !== undefined) {
    payload.latitude = Number(payload.latitude);
  }
  if (payload.longitude !== undefined) {
    payload.longitude = Number(payload.longitude);
  }

  const validatedData = await sellerValidation.updateSellerProfileSchema.parseAsync(payload);

  const result = await SellerService.updateSellerProfile(decodedUser.userId, validatedData);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Seller profile updated successfully",
    data: result,
  });
});


const getAllSellerRequests = catchAsync(async (req: Request, res: Response) => {
  const result = await SellerService.getAllSellerRequests(req.query);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Seller requests retrieved successfully",
    data: result,
  });
});


const getAllSellers = catchAsync(async (req: Request, res: Response) => {
  const result = await SellerService.getAllSellers(req.query);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Sellers retrieved successfully",
    data: result,
  });
});


const getSellerRequestById = catchAsync(async (req: Request, res: Response) => {
  const result = await SellerService.getSellerRequestById(req.params.id as string);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Seller request retrieved successfully",
    data: result,
  });
});


const approveOrRejectSellerRequest = catchAsync(async (req: Request, res: Response) => {
  const profileId = req.params.id;
  const payload = req.body;

  const result = await SellerService.approveOrRejectSellerRequest(profileId as string, payload);

  const action = payload.status === 'APPROVED' ? 'approved' : 'rejected';

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: `Seller application ${action} successfully`,
    data: result,
  });
});


const changeSellerStatus = catchAsync(async (req: Request, res: Response) => {
  const rawId = (req.params.sellerId || req.params.id) as string;
  const sellerId = rawId ? rawId.replace(/^:/, "") : "";
  const payload = req.body;

  const result = await SellerService.changeSellerStatus(sellerId, payload);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: `Seller profile status updated to ${payload.status} successfully`,
    data: result,
  });
});

export const SellerController = {
  submitSellerRequest,
  getMySellerProfile,
  updateSellerProfile,
  getAllSellerRequests,
  getAllSellers,
  getSellerRequestById,
  approveOrRejectSellerRequest,
  changeSellerStatus,
};
