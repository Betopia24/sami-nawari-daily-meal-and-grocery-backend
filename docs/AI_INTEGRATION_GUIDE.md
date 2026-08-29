# Sami Nawari — Food AI Service Integration Guide

This guide details the complete integration architecture, request flows, authentication mechanisms, and API contracts between the **Main Backend (Node.js + Express + Prisma / MongoDB)** and the **AI Backend (FastAPI + PostgreSQL/pgvector + Redis)**.

---

## 1. Architecture Flow & Principles

```text
Flutter App (User / Seller JWT)
    │
    │ 1. Public API Request
    │ Authorization: Bearer <USER_JWT>
    ▼
Main Backend (Express Gateway)
    │
    │ 2. Outbound Proxy Request (with UUID conversion)
    │ Authorization: Bearer <AI_SERVICE_TOKEN>
    │ X-User-ID: <verified-user-uuid>
    ▼
AI Backend (FastAPI)
    │
    │ 3. Internal Callback for Canonical Data
    │ Authorization: Bearer <MAIN_BACKEND_SERVICE_TOKEN>
    ▼
Main Backend Internal Endpoints (`/api/v1/internal/ai/...`)
    │
    │ 4. DB Query (MongoDB/Prisma) & DTO Mapping
    ▼
Canonical JSON Response (`{"data": ...}`) ──► AI Processing ──► Main Backend ──► Flutter Client
```

### Core Design Principles
1. **Single Source of Truth**: The Main Backend owns all business data (Users, Foods, Recipes, Meal Plans, Orders). The AI Backend holds intelligence and transient state only.
2. **Direct Access Restriction**: The AI Backend never accesses MongoDB directly. It requests canonical data strictly via Main Backend internal read APIs.
3. **ID Translation (ObjectId → UUID)**: MongoDB 24-character hex ObjectIds are converted to RFC-4122 compliant UUID v5 deterministically (`objectIdToUuid`) so FastAPI Pydantic schema validation parses them seamlessly.

---

## 2. Environment Configuration (.env)

The following keys must be set in `sami-nawari-daily-meal-and-grocery-backend/.env`:

```env
# AI Service Credentials
AI_BASE_URL=http://206.162.244.131:8035
AI_SERVICE_TOKEN=token_food_ai_service_secret
MAIN_BACKEND_SERVICE_TOKEN=token_main_backend_service_secret
```

---

## 3. Public Gateway APIs for Flutter Client

All public endpoints are exposed through the Main Backend and require valid user authentication.

**Base URL**: `https://your-main-backend-domain.com/api/v1`  
**Required Header**: `Authorization: Bearer <USER_JWT>`

### 3.1 Food & Recipe Recommendations

#### 1. Personalized Food Recommendation
* **Method & Route**: `POST /recommendations/foods`
* **Request Body**:
  ```json
  {
    "limit": 10,
    "meal_type": "lunch",
    "delivery_zone_id": null,
    "exclude_food_ids": []
  }
  ```

#### 2. Personalized Recipe Recommendation
* **Method & Route**: `POST /recommendations/recipes`
* **Request Body**:
  ```json
  {
    "limit": 10,
    "meal_type": "lunch",
    "max_cooking_time_minutes": 60,
    "exclude_recipe_ids": []
  }
  ```

---

### 3.2 AI Meal Plan Generator & Replacement

#### 3. Generate AI Meal Plan
* **Method & Route**: `POST /meal-plans/generate`
* **Headers**: `Idempotency-Key: <unique-uuid>` (Optional)
* **Request Body**:
  ```json
  {
    "start_date": "2026-08-29",
    "days": 3,
    "meals_per_day": ["breakfast", "lunch", "dinner"],
    "goal_override": null,
    "excluded_recipe_ids": []
  }
  ```

#### 4. Meal Item Replacement Options
* **Method & Route**: `POST /meal-plans/:id/replacement-options`
* **Request Body**:
  ```json
  {
    "meal_item_id": "mpi_001"
  }
  ```

---

### 3.3 Nutrition Insights

#### 5. Generate Nutrition Insights
* **Method & Route**: `POST /meal-plans/:id/insights`
* **Headers**: `Idempotency-Key: <unique-uuid>` (Optional)

#### 6. Get Latest Nutrition Insights
* **Method & Route**: `GET /meal-plans/:id/insights/latest`

---

### 3.4 Grocery Drafts

#### 7. Grocery List Draft from Meal Plan
* **Method & Route**: `POST /grocery-drafts/from-meal-plan`
* **Request Body**:
  ```json
  {
    "meal_plan_id": "mp1"
  }
  ```

#### 8. Grocery List Draft from Recipe
* **Method & Route**: `POST /grocery-drafts/from-recipe`
* **Request Body**:
  ```json
  {
    "recipe_id": "r1",
    "servings": 4
  }
  ```

---

### 3.5 Allergy & Dietary Compatibility Check

#### 9. Single Compatibility Check
* **Method & Route**: `POST /compatibility/check`
* **Request Body**:
  ```json
  {
    "resource_type": "recipe",
    "resource_id": "r1"
  }
  ```

#### 10. Batch Compatibility Check
* **Method & Route**: `POST /compatibility/check-batch`
* **Request Body**:
  ```json
  {
    "items": [
      { "resource_type": "food", "resource_id": "f1" },
      { "resource_type": "recipe", "resource_id": "r1" }
    ]
  }
  ```

---

### 3.6 Seller AI Recipe Generation

#### 11. Generate Recipe Draft for Food Item
* **Method & Route**: `POST /seller-foods/:id/recipe-drafts/generate`
* **Headers**: `Idempotency-Key: <unique-uuid>` (Optional)

#### 12. Regenerate Recipe Draft
* **Method & Route**: `POST /seller-foods/:generationId/recipe-drafts/regenerate`

---

### 3.7 Recommendation Interaction Event Tracking

#### 13. Track Recommendation Click Event
* **Method & Route**: `POST /recommendation-events`
* **Request Body**:
  ```json
  {
    "recommendation_id": "rec_xxx",
    "item_type": "food",
    "item_id": "f1",
    "event": "clicked"
  }
  ```

---

## 4. Main Backend Internal Callback APIs (7 Endpoints)

The AI Backend consumes these endpoints to retrieve canonical data structures.

**Base URL**: `https://your-main-backend-domain.com/internal/ai`  
**Required Header**: `Authorization: Bearer <MAIN_BACKEND_SERVICE_TOKEN>`

| Method | Path | Response Wrapper | Description |
|---|---|---|---|
| GET | `/users/:user_id/profile` | `{"data": UserAIProfile}` | User preferences, allergies & nutrition goal |
| GET | `/foods/candidates` | `{"data": FoodItem[]}` | Published food candidates canonical DTO |
| GET | `/recipes/candidates` | `{"data": Recipe[]}` | Published recipe candidates canonical DTO |
| GET | `/foods/:food_id` | `{"data": FoodItem}` | Food details with canonical ingredients |
| GET | `/recipes/:recipe_id` | `{"data": Recipe}` | Recipe details and per-serving nutrition DTO |
| GET | `/meal-plans/:plan_id` | `{"data": StoredMealPlan}` | Meal plan content (User Ownership Verified) |
| GET | `/seller-foods/:food_id/draft` | `{"data": SellerFoodDraft}` | Seller food draft (Seller Ownership Verified) |

---

## 5. Directory Structure

```text
src/app/modules/ai/
├── ai.interface.ts          # Canonical DTO Types & Interfaces
├── ai.utils.ts              # UUID v5 Converter & Canonical DTO Mappers
├── ai.service.ts            # Centralized Outbound HTTP Client to FastAPI
├── ai.internal.controller.ts# 7 Internal Callback Controllers
├── ai.internal.route.ts     # Internal Callback Routes (/internal/ai/...)
├── ai.public.controller.ts  # Flutter Public Gateway Controllers
└── ai.public.route.ts       # Public Routes (/recommendations, /meal-plans, etc.)
```
