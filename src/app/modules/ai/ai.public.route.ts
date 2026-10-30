import { Router } from "express";
import auth from "../../middlewares/auth";
import { AIPublicController } from "./ai.public.controller";

const router = Router();


router.use(auth());


router.post("/recommendations/foods", AIPublicController.getFoodRecommendations);
router.post("/recommendations/recipes", AIPublicController.getRecipeRecommendations);


router.post("/meal-plans/generate", AIPublicController.generateMealPlan);
router.get("/meal-plans", AIPublicController.getMyMealPlans);
router.get("/meal-plans/:id", AIPublicController.getMealPlan);
router.post("/meal-plans/:id/items/:mealItemId/replacement-options", AIPublicController.getReplacementOptions);
router.post("/meal-plans/:id/insights", AIPublicController.generateNutritionInsights);
router.get("/meal-plans/:id/insights/latest", AIPublicController.getLatestNutritionInsights);


router.post("/grocery-drafts/from-meal-plan", AIPublicController.getGroceryDraftFromMealPlan);
router.post("/grocery-drafts/from-recipe", AIPublicController.getGroceryDraftFromRecipe);


router.post("/compatibility/check", AIPublicController.checkCompatibility);
router.post("/compatibility/check-batch", AIPublicController.checkCompatibilityBatch);


router.post("/seller-foods/:id/recipe-drafts/generate", AIPublicController.generateSellerRecipeDraft);
router.post("/seller-foods/:generationId/recipe-drafts/regenerate", AIPublicController.regenerateSellerRecipeDraft);


router.post("/recommendation-events", AIPublicController.trackRecommendationEvent);

export const AIPublicRoutes = router;
