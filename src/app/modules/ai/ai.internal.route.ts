import { Router } from "express";
import { internalAuth } from "../../middlewares/internalAuth";
import { AIInternalController } from "./ai.internal.controller";

const router = Router();

router.use(internalAuth);

router.get("/users/:user_id/profile", AIInternalController.getUserProfile);
router.post("/users/:user_id/profile-cache/invalidate", AIInternalController.invalidateProfileCache);
router.get("/foods/candidates", AIInternalController.getFoodCandidates);
router.get("/recipes/candidates", AIInternalController.getRecipeCandidates);
router.get("/foods/:food_id", AIInternalController.getFoodById);
router.get("/recipes/:recipe_id", AIInternalController.getRecipeById);
router.get("/meal-plans/:plan_id", AIInternalController.getMealPlanById);
router.get("/seller-foods/:food_id/draft", AIInternalController.getSellerFoodDraft);

export const AIInternalRoutes = router;
