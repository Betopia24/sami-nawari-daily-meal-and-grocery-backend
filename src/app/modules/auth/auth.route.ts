
import express from 'express'
import { AuthController } from './auth.controller'
import validateRequest from '../../middlewares/validateRequest'
import { userValidation } from '../user/user.validation'
import { AuthValidation } from './auth.validation'

const router = express.Router()

router.post(
  "/register",
  validateRequest(userValidation.registerUserValidationSchema),
  AuthController.register
)
router.post(
  "/social-login",
  validateRequest(AuthValidation.socialLoginValidationSchema),
  AuthController.socialLogin
)
router.post("/login", AuthController.login)
router.post("/logout", AuthController.logout)
router.post("/forgot-password", AuthController.forgotPassword);
router.post("/reset-password", AuthController.resetPassword);

export const AuthRoutes = router