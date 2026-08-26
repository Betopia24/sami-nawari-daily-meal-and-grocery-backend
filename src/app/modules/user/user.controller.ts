/* eslint-disable @typescript-eslint/no-explicit-any */
import { Request, Response } from "express";
import catchAsync from "../../utils/catchAsync";
import sendResponse from "../../utils/sendResponse";
import { fileUpload } from "../../utils/fileUpload";
import { UserService } from "./user.service";
import { userValidation } from "./user.validation";

const createUser = catchAsync(async (req: Request, res: Response) => {
    const user = await UserService.createUser(req);
    sendResponse(res, {
        statusCode: 200,
        success: true,
        message: "user created successfully",
        data: user
    })
});

const getAllUsers = catchAsync(async (req: Request, res: Response) => {
    const users = await UserService.getAllUsers(req.query);
    sendResponse(res, {
        statusCode: 200,
        success: true,
        message: "users retrieved successfully",
        data: users
    })
});

// New: Get current authenticated user
const getSingleUser = catchAsync(async (req: Request & { user?: any }, res: Response) => {

    const decodedUser = req.user as any;

    const user = await UserService.getSingleUser(decodedUser.userId);


    sendResponse(res, {
        statusCode: 200,
        success: true,
        message: "Current user retrieved successfully",
        data: user
    });
});

const getFindUserById = catchAsync(async (req: Request & { user?: any }, res: Response) => {

    const decodedUser = req.user as any;

    const user = await UserService.findUserById(decodedUser.userId);


    sendResponse(res, {
        statusCode: 200,
        success: true,
        message: "Current user retrieved successfully",
        data: user
    });
});


const userUpdateProfile = catchAsync(async (req: Request & { user?: any }, res: Response) => {
    const decodedUser = req.user as any;
    let payload = req.body;
    if (req.body.data) {
        payload = JSON.parse(req.body.data);
    }

    const validatedData = await userValidation.updateUserValidationSchema.parseAsync(payload);

    if (req.file) {
        const uploadResult = await fileUpload.uploadToCloudinary(req.file);
        if (uploadResult && uploadResult.secure_url) {
            validatedData.profilePicture = uploadResult.secure_url;
        }
    }

    const result = await UserService.userUpdateProfile(decodedUser.userId, validatedData)

    sendResponse(res, {
        success: true,
        statusCode: 200,
        message: "User profile updated successfully",
        data: result
    });
})

const userUpdatePassword = catchAsync(async (req: Request & { user?: any }, res: Response) => {
    const decodedUser = req.user as any;
    const payload = req.body;

    const result = await UserService.userUpdatePassword(decodedUser.userId, payload);

    sendResponse(res, {
        success: true,
        statusCode: 200,
        message: "Password updated successfully",
        data: result
    });
})

const deleteUser = catchAsync(async (req: Request & { user?: any }, res: Response) => {
    const adminId = req.user.userId;
    const user = await UserService.deleteUser(req.params.id as string, adminId as string);
    sendResponse(res, {
        statusCode: 200,
        success: true,
        message: "User deleted successfully",
        data: user
    })
});

const userUpdateLanguageRegion = catchAsync(async (req: Request & { user?: any }, res: Response) => {
    const decodedUser = req.user as any;
    const payload = req.body;

    const result = await UserService.userUpdateLanguageRegion(decodedUser.userId, payload)

    sendResponse(res, {
        success: true,
        statusCode: 200,
        message: "Language and region settings updated successfully",
        data: result
    });
})

const userUpdateDietaryPreferences = catchAsync(async (req: Request & { user?: any }, res: Response) => {
    const decodedUser = req.user as any;
    const payload = req.body;

    const result = await UserService.userUpdateDietaryPreferences(decodedUser.userId, payload)

    sendResponse(res, {
        success: true,
        statusCode: 200,
        message: "Dietary preferences updated successfully",
        data: result
    });
})

const userUpdateAllergies = catchAsync(async (req: Request & { user?: any }, res: Response) => {
    const decodedUser = req.user as any;
    const payload = req.body;

    const result = await UserService.userUpdateAllergies(decodedUser.userId, payload)

    sendResponse(res, {
        success: true,
        statusCode: 200,
        message: "Allergies and intolerances updated successfully",
        data: result
    });
})

const changeUserStatus = catchAsync(async (req: Request & { user?: any }, res: Response) => {
    const userId = req.params.id;
    const adminId = req.user.userId;
    const payload = req.body;

    const result = await UserService.changeUserStatus(userId as string, adminId as string, payload);

    sendResponse(res, {
        success: true,
        statusCode: 200,
        message: "User status updated successfully",
        data: result
    });
})

const switchUserRole = catchAsync(async (req: Request & { user?: any }, res: Response) => {
    const decodedUser = req.user as any;

    const result = await UserService.switchUserRole(decodedUser.userId);

    const isSecure = req.secure || req.headers['x-forwarded-proto'] === 'https';

    res.cookie('accessToken', result.accessToken, {
        secure: isSecure,
        httpOnly: true,
        sameSite: isSecure ? 'none' : 'lax',
        maxAge: 1000 * 60 * 60 * 24 * 365,
    });
    res.cookie('refreshToken', result.refreshToken, {
        secure: isSecure,
        httpOnly: true,
        sameSite: isSecure ? 'none' : 'lax',
        maxAge: 1000 * 60 * 60 * 24 * 365,
    });

    sendResponse(res, {
        success: true,
        statusCode: 200,
        message: `Switched to ${result.user.role.charAt(0) + result.user.role.slice(1).toLowerCase()} mode successfully`,
        data: {
            user: result.user,
            accessToken: result.accessToken,
            refreshToken: result.refreshToken,
        }
    });
})

export const UserController = {
    createUser,
    getAllUsers,
    getSingleUser,
    getFindUserById,
    userUpdateProfile,
    userUpdatePassword,
    userUpdateLanguageRegion,
    userUpdateDietaryPreferences,
    userUpdateAllergies,
    changeUserStatus,
    deleteUser,
    switchUserRole
};