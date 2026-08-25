// Updated config to ensure environment variables are reloaded
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(process.cwd(), '.env') });

export default {
  node_env: process.env.NODE_ENV,
  port: process.env.PORT,
  database_url: process.env.DATABASE_URL,

  jwt: {
    accessToken: process.env.JWT_ACCESS_SECRET,
    refreshToken: process.env.JWT_REFRESH_SECRET,
    accessTokenExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN,
    refreshTokenExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN,
    reset_pass_secret: process.env.JWT_RESET_PASS_SECRET,
    reset_pass_token_expires_in: process.env.JWT_RESET_PASS_EXPIRES_IN,
  },

  cloudinary: {
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  },

  nodeMiller: {
    email_host: process.env.EMAIL_HOST,
    email_port: process.env.EMAIL_PORT,
    email_user: process.env.EMAIL_USER,
    email_pass: process.env.EMAIL_PASS,
    email_from: process.env.EMAIL_FROM,
  },

  stripe: {
    stripeSecretKey: process.env.STRIPE_SECRET_KEY,
    stripeWebHookSecret: process.env.STRIPE_WEBHOOK_SECRET,
    frontendUrl: process.env.FRONTEND_URL,
  },

  //  redirect url
  frontendSuccessUrl: process.env.FRONTEND_SUCCESS_URL,
  frontendFailUrl: process.env.FRONTEND_FAIL_URL,
  frontendCancelUrl: process.env.FRONTEND_CANCEL_URL,

  admin: {
    email: process.env.ADMIN_EMAIL,
    password: process.env.ADMIN_PASSWORD,
  },

  salt_rounds: Number(process.env.SALT_ROUNDS),

  reset_pass_link: process.env.RESET_PASS_LINK,

  firebase: {
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY,
  },

  redis: {
    host: process.env.REDIS_HOST || "localhost",
    port: Number(process.env.REDIS_PORT) || 6379,
    username: process.env.REDIS_USERNAME || undefined,
    password: process.env.REDIS_PASSWORD || undefined,
  },
};
