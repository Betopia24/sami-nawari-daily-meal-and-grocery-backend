import { UserRole } from "@prisma/client";
import express from "express";
import auth from "../../middlewares/auth";
import validateRequest from "../../middlewares/validateRequest";
import { fileUpload } from "../../utils/fileUpload";
import { UserController } from "./user.controller";
import { userValidation } from "./user.validation";

const router = express.Router();


router.get("/me", auth(UserRole.BUYER, UserRole.SELLER, UserRole.ADMIN), UserController.getSingleUser);


router.get("/:id", auth(UserRole.ADMIN), UserController.getFindUserById);


router.get("/", auth(UserRole.ADMIN), UserController.getAllUsers);

// router.post(
//     "/",
//     validateRequest(userValidation.createUserValidationSchema),
//     UserController.createUser
// );

router.patch(
    "/update-profile",
    auth(UserRole.BUYER, UserRole.SELLER, UserRole.ADMIN),
    fileUpload.upload.single("file"),
    UserController.userUpdateProfile
);

router.patch(
    "/update-password",
    auth(UserRole.BUYER, UserRole.SELLER, UserRole.ADMIN),
    validateRequest(userValidation.updatePasswordValidationSchema),
    UserController.userUpdatePassword
);

router.patch(
    "/update-language-region",
    auth(UserRole.BUYER, UserRole.SELLER, UserRole.ADMIN),
    validateRequest(userValidation.updateLanguageRegionValidationSchema),
    UserController.userUpdateLanguageRegion
);

router.patch(
    "/update-dietary-preferences",
    auth(UserRole.BUYER, UserRole.SELLER, UserRole.ADMIN),
    validateRequest(userValidation.updateDietaryPreferencesValidationSchema),
    UserController.userUpdateDietaryPreferences
);

router.patch(
    "/update-allergies",
    auth(UserRole.BUYER, UserRole.SELLER, UserRole.ADMIN),
    validateRequest(userValidation.updateAllergiesValidationSchema),
    UserController.userUpdateAllergies
);

router.patch(
    "/change-status/:id",
    auth(UserRole.ADMIN),
    validateRequest(userValidation.changeUserStatusValidationSchema),
    UserController.changeUserStatus
);

router.delete("/:id", auth(UserRole.ADMIN), UserController.deleteUser);

// Switch role between BUYER and SELLER (only for approved sellers)
router.patch(
    "/switch-role",
    auth(UserRole.BUYER, UserRole.SELLER),
    UserController.switchUserRole
);




export const UserRoutes = router;