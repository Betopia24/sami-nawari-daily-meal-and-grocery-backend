# Flutter Client AI Integration Guide

This guide documents the **Public AI Gateway Endpoints** exposed by the Main Backend for the Flutter application. 

* **Base URL:** `https://your-domain.com/api/v1`
* **Authentication Header:** `Authorization: Bearer <USER_JWT_TOKEN>` (standard buyer/seller token)

---

## 1. Recommendations

### 1.1 Food Recommendations
Retrieve AI-personalized food recommendation candidates.

* **Method:** `POST`
* **Path:** `/ai/recommendations/foods`
* **Request Body:**
```json
{
  "limit": 10,
  "meal_type": "lunch",
  "delivery_zone_id": null,
  "exclude_food_ids": []
}
```
* **Response:**
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Food recommendations retrieved successfully",
  "data": {
    "recommendation_id": "rec_6114ce2776714844b90a55a5991554c6",
    "items": [
      {
        "item_id": "a1b7c3c2-a8e7-50c0-8467-d3297c702502",
        "food_id": "6ae06891dc9af68b3aa4bf41",
        "score": 0.859,
        "compatibility": "safe",
        "reasons": [
          "matches_cuisine",
          "matches_goal"
        ],
        "food": {
          "id": "6ae06891dc9af68b3aa4bf41",
          "name": "Mango",
          "description": "Fresh mango",
          "images": [],
          "price": 120,
          "category": "LUNCH",
          "preparationTime": "15 min",
          "deliveryFee": 0,
          "ingredients": []
        }
      }
    ]
  }
}
```

`item_id` is the AI recommendation ID. `food_id` is the MongoDB food ID, and `food` contains the resolved food record so the client can render the recommendation card directly.

---

### 1.2 Recipe Recommendations
Retrieve AI-personalized home-cooking recipe recommendations.

* **Method:** `POST`
* **Path:** `/ai/recommendations/recipes`
* **Request Body:**
```json
{
  "limit": 10,
  "meal_type": "lunch",
  "max_cooking_time_minutes": 60,
  "exclude_recipe_ids": []
}
```
* **Response:**
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Recipe recommendations retrieved successfully",
  "data": {
    "recommendation_id": "rec_de958dbffc4b4325abc381fee3f7d1e7",
    "items": [
      {
        "item_id": "r1",
        "score": 0.961,
        "compatibility": "safe",
        "reasons": [
          "preferred_cuisine",
          "goal_match"
        ]
      }
    ]
  }
}
```

---

### 1.3 Track Recommendation Event
Send user feedback when they click/view recommendations (for reinforcement learning).

* **Method:** `POST`
* **Path:** `/ai/recommendation-events`
* **Request Body:**
```json
{
  "recommendation_id": "rec_6114ce2776714844b90a55a5991554c6",
  "item_type": "food",
  "item_id": "f1",
  "event": "clicked"
}
```
* **Response:**
* **Status:** `204 No Content` (Empty Response Body)

---

## 2. Meal Plans

### 2.1 Generate Meal Plan
Generate a custom multi-day meal plan based on preferences.

* **Method:** `POST`
* **Path:** `/ai/meal-plans/generate`
* **Headers:** Include optional `Idempotency-Key` to avoid double generations on slow connections.
  * `Idempotency-Key: plan-session-abc123`
* **Request Body:**
```json
{
  "start_date": "2026-08-26",
  "days": 3,
  "meals_per_day": [
    "breakfast",
    "lunch",
    "dinner"
  ],
  "goal_override": null,
  "excluded_recipe_ids": []
}
```
* **Response:**
```json
{
  "success": true,
  "statusCode": 200,
  "message": "AI Meal Plan generated successfully",
  "data": {
    "generation_id": "gen_mp_3c6bae94d834479bb9dc67c4231cd250",
    "profile_version": 3,
    "plan": {
      "days": [
        {
          "date": "2026-08-26",
          "meals": [
            {
              "meal_type": "breakfast",
              "recipe_id": "r1",
              "servings": 4
            },
            {
              "meal_type": "lunch",
              "recipe_id": "r2",
              "servings": 4
            }
          ]
        }
      ]
    }
  }
}
```

---

### 2.2 Get Replacement Options
Find alternative recipes to swap into a generated meal plan.

* **Method:** `POST`
* **Path:** `/ai/meal-plans/:id/items/:mealItemId/replacement-options`
* **Request Body:**
```json
{
  "preference": "fish",
  "limit": 3
}
```
* **Response:**
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Meal replacement options retrieved successfully",
  "data": {
    "items": [
      {
        "recipe_id": "r2",
        "score": 0.95,
        "reasons": ["high_protein_match"]
      }
    ]
  }
}
```

---

### 2.3 Generate Nutrition Insights
Generate structured feedback and tips for a generated meal plan.

* **Method:** `POST`
* **Path:** `/ai/meal-plans/:id/insights`
* **Response:**
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Nutrition insights generated successfully",
  "data": {
    "generation_id": "gen_insight_33f9f0e4a46e495380e19430413bbda9",
    "nutrition": {
      "calories": 1600,
      "protein_g": 120,
      "carbs_g": 200,
      "fat_g": 40,
      "fiber_g": 20,
      "sugar_g": 0,
      "sodium_mg": 0
    },
    "insight": {
      "summary": "Plan provides 1,600 calories, with balanced macronutrient profile.",
      "positive_points": [
        "Includes fiber",
        "Protein is 120g"
      ],
      "suggestions": [
        "Include vitamins"
      ]
    }
  }
}
```

---

### 2.4 Get Latest Nutrition Insights
Retrieve cached insights without recalculating.

* **Method:** `GET`
* **Path:** `/ai/meal-plans/:id/insights/latest`
* **Response:**
*(Same JSON structure as 2.3)*

---

## 3. Grocery Drafts

### 3.1 Grocery Draft from Meal Plan
Export ingredients needed for a meal plan directly into a grocery list draft.

* **Method:** `POST`
* **Path:** `/ai/grocery-drafts/from-meal-plan`
* **Request Body:**
```json
{
  "meal_plan_id": "mp1"
}
```
* **Response:**
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Grocery list draft from meal plan created successfully",
  "data": {
    "source_type": "meal_plan",
    "source_id": "mp1",
    "items": [
      {
        "ingredient_id": "rice",
        "name": "Rice",
        "quantity": 400,
        "unit": "g",
        "category": "grains"
      },
      {
        "ingredient_id": "chicken",
        "name": "Chicken",
        "quantity": 300,
        "unit": "g",
        "category": "protein"
      }
    ]
  }
}
```

---

### 3.2 Grocery Draft from Recipe
Export ingredients from a single recipe scaled by servings.

* **Method:** `POST`
* **Path:** `/ai/grocery-drafts/from-recipe`
* **Request Body:**
```json
{
  "recipe_id": "r1",
  "servings": 4
}
```
* **Response:**
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Grocery list draft from recipe created successfully",
  "data": {
    "source_type": "recipe",
    "source_id": "r1",
    "items": [
      {
        "ingredient_id": "rice",
        "name": "Rice",
        "quantity": 400,
        "unit": "g",
        "category": "grains"
      }
    ]
  }
}
```

---

## 4. User Safety & Allergens Compatibility

### 4.1 Check Compatibility
Verify if a food candidate or recipe is safe for the user's allergens/preferences.

* **Method:** `POST`
* **Path:** `/ai/compatibility/check`
* **Request Body:**
```json
{
  "resource_type": "recipe",
  "resource_id": "r1"
}
```
* **Response:**
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Compatibility check completed",
  "data": {
    "resource_type": "recipe",
    "resource_id": "r1",
    "status": "safe",
    "conflicts": [],
    "unknown_ingredients": []
  }
}
```

---

### 4.2 Check Compatibility Batch
Verify compatibility of multiple foods/recipes in a single request.

* **Method:** `POST`
* **Path:** `/ai/compatibility/check-batch`
* **Request Body:**
```json
{
  "items": [
    {
      "resource_type": "food",
      "resource_id": "f1"
    },
    {
      "resource_type": "recipe",
      "resource_id": "r1"
    }
  ]
}
```
* **Response:**
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Batch compatibility check completed",
  "data": {
    "items": [
      {
        "resource_type": "food",
        "resource_id": "f1",
        "status": "safe",
        "conflicts": [],
        "unknown_ingredients": []
      },
      {
        "resource_type": "recipe",
        "resource_id": "r1",
        "status": "warning",
        "conflicts": ["contains_peanuts"],
        "unknown_ingredients": []
      }
    ]
  }
}
```

---

## 5. Seller Hub (Recipe Drafting)

### 5.1 Generate Seller Recipe Draft
Generate cooking steps and ingredients for a seller's food item listing draft.

* **Method:** `POST`
* **Path:** `/ai/seller-foods/:id/recipe-drafts/generate`
* **Request Body:**
```json
{
  "language": "en"
}
```
* **Response:**
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Seller recipe draft generated successfully",
  "data": {
    "generation_id": "gen_recipe_f02cb39da561489295158d7472025f78",
    "recipe": {
      "title": "Chicken Khichuri",
      "summary": "Traditional homemade Bangladeshi meal of rice and chicken.",
      "servings": 4,
      "prep_time_minutes": 20,
      "cook_time_minutes": 40,
      "ingredients": [
        {
          "ingredient_id": "rice",
          "name": "Rice",
          "quantity": 200,
          "unit": "g"
        }
      ],
      "steps": [
        {
          "step_number": 1,
          "instruction": "Wash the rice thoroughly."
        }
      ],
      "suggested_missing_ingredients": ["Salt", "Turmeric"]
    }
  }
}
```

---

### 5.2 Regenerate Seller Recipe Draft
Refine draft recipes based on specific custom instructions.

* **Method:** `POST`
* **Path:** `/ai/seller-foods/:generationId/recipe-drafts/regenerate`
* **Request Body:**
```json
{
  "previous_generation_id": "gen_recipe_f02cb39da561489295158d7472025f78",
  "instructions": "Make the preparation instructions simpler and shorter."
}
```
* **Response:**
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Seller recipe draft regenerated successfully",
  "data": {
    "generation_id": "gen_recipe_0b9bbb6acc7141229dc933382c8aa3ab",
    "recipe": {
      "title": "Chicken Khichuri",
      "summary": "Simple Bangladeshi dish.",
      "servings": 4,
      "prep_time_minutes": 20,
      "cook_time_minutes": 40,
      "ingredients": [
        {
          "ingredient_id": "rice",
          "name": "Rice",
          "quantity": 200,
          "unit": "g"
        }
      ],
      "steps": [
        {
          "step_number": 1,
          "instruction": "Wash rice and cook chicken."
        }
      ]
    }
  }
}
```
