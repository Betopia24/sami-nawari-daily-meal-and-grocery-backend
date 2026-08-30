# Sami Nawari - Daily Meal and Grocery Backend

A production-ready, scalable modular backend API built with Node.js, Express, and TypeScript. This application powers a daily meal marketplace and collaborative grocery platform.

## Features

- Modular Architecture: Highly organized structure where each domain (authentication, user, seller, food, order, grocery, review, notification) is contained within its own module (controller, route, service, validation, and interface).
- Authentication and Security:
  - JSON Web Tokens (JWT) for secure authentication.
  - Multi-role permission system supporting admin, buyer, and seller roles.
  - Rate limiting on sensitive endpoints (e.g., geospatial searches and public routes).
  - Encrypted passwords using bcryptjs.
- Collaborative Grocery Management:
  - Group grocery lists with real-time membership invitations.
  - Shared tracking of items added and completed by members.
- Seller and Kitchen Profiles:
  - Geospatial location tracking (latitude/longitude) with 2dsphere indexing for finding nearby home kitchens.
  - Seller application, approval, suspension, and activation workflows.
  - Custom cuisines, pickup/delivery support, and working hours configurations.
- Food Listings and Caching:
  - Food creation, category, and subcategory mappings.
  - Review queue for new food items by administrators.
  - High-performance caching using Redis for food menus and detail pages.
- Order and Payment Flow:
  - Parent order splitting into individual seller child orders.
  - Stripe payment integration with Stripe webhooks for asynchronous payment status confirmation.
  - Concurrent lock mechanism using Redis to prevent race conditions during status updates.
- Asynchronous Task Processing:
  - Outbox Pattern implemented with BullMQ and Redis to ensure reliable transactional event delivery.
  - Asynchronous background workers for processing order state changes and emails.
- Email and Push Notifications:
  - Automated HTML email templates for seller status, order notifications, and verification.
  - Integration with Firebase Admin SDK for push notifications and social logins.

## Tech Stack

- Runtime Environment: Node.js
- Framework: Express.js
- Language: TypeScript
- ORM: Prisma
- Database: MongoDB
- Cache and Message Broker: Redis
- Task Scheduler / Queue: BullMQ
- Payment Processor: Stripe
- Third-Party Integrations: Firebase Admin SDK, Cloudinary, Nodemailer
- Loggers and Utilities: Morgan, Zod Validation, Express Rate Limit

## Project Structure

```text
src/
+- app/
   +- config/         # System configuration and environment variables
   +- errors/         # Global error definitions and handlers
   +- jobs/           # BullMQ queue workers and outbox processors
   +- middlewares/    # Authentication, rate limiting, and request validation middlewares
   +- modules/        # Modular domains containing logic, routes, and services
      +- ai/          # AI client gateway and assistant endpoints
      +- auth/        # Login, registration, password resets, and verification
      +- bookmark/    # Customer bookmarked food items
      +- cart/        # Shopping cart state management
      +- explore/     # Public geospatial search and menu/review retrievals
      +- food/        # Food items addition, management, and admin reviews
      +- grocery/     # Collaborative grocery lists and member invites
      +- notification/# FCM push notification triggers
      +- order/       # Parent/child order processing, status locks, and Stripe triggers
      +- payment/     # Stripe payments and webhook events
      +- review/      # User ratings and restaurant/food reviews
      +- seller/      # Seller profile setup, location configs, and admin approvals
      +- user/        # User accounts, switch roles, and profile settings
   +- prisma/         # Prisma client initializer
   +- routes/         # Central router registering all modular routes
   +- utils/          # Encryption, email templates, image uploaders, and Redis clients
+- prisma/
   +- schema/         # Modular Prisma database schema files (MongoDB)
+- scripts/           # Automation scripts (e.g. module generator)
+- dist/              # Compiled JavaScript output
```

## Setup and Installation

### Prerequisites

- Node.js (v18 or higher recommended)
- pnpm (package manager)
- MongoDB Instance
- Redis Instance

### Steps

1. Clone the repository and navigate to the project directory:
   ```bash
   git clone <repository-url>
   cd sami-nawari-daily-meal-and-grocery-backend
   ```

2. Install dependencies:
   ```bash
   pnpm install
   ```

3. Configure environment variables. Create a `.env` file in the root directory and add the following configurations:
   ```env
   PORT=5478
   DATABASE_URL="mongodb+srv://..."
   REDIS_URL="redis://localhost:6379"
   JWT_ACCESS_SECRET="your_access_secret"
   JWT_REFRESH_SECRET="your_refresh_secret"
   STRIPE_SECRET_KEY="your_stripe_secret_key"
   STRIPE_WEBHOOK_SECRET="your_stripe_webhook_secret"
   CLOUDINARY_CLOUD_NAME="your_cloud_name"
   CLOUDINARY_API_KEY="your_api_key"
   CLOUDINARY_API_SECRET="your_api_secret"
   ```

4. Generate Prisma client:
   ```bash
   pnpm prisma generate
   ```

5. Push database schemas to MongoDB:
   ```bash
   pnpm prisma db push
   ```

## Development and Scripts

Run the following commands in the root directory:

- Run development server (with hot reload):
  ```bash
  pnpm dev
  ```
- Build the project:
  ```bash
  pnpm build
  ```
- Start production server:
  ```bash
  pnpm start
  ```
- Run code quality linter:
  ```bash
  pnpm lint
  ```
- Scaffold a new module (using helper script):
  ```bash
  pnpm make:module <module_name>
  ```
