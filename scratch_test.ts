import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function testAll() {
  console.log('--- STARTING COMPREHENSIVE INTERNAL AI API TESTS ---');
  const baseUrl = 'http://localhost:5478';

  // 1. Fetch real records from DB
  const sampleUser = await prisma.user.findFirst();
  const sampleFood = await prisma.food.findFirst({
    include: { sellerProfile: true }
  });
  let sampleMealPlan = await prisma.mealPlan.findFirst();

  if (!sampleMealPlan && sampleUser) {
    // Create a dummy meal plan for testing if none exists
    sampleMealPlan = await prisma.mealPlan.create({
      data: {
        planId: 'plan-test-101',
        userId: sampleUser.id,
        version: 1,
        days: [
          {
            date: '2026-10-28',
            meals: [
              {
                meal_type: 'lunch',
                recipe_id: sampleFood ? sampleFood.id : 'recipe-dummy-1',
                servings: 2,
              },
            ],
          },
        ],
      },
    });
    console.log('[Setup] Created test meal plan:', sampleMealPlan.id);
  }

  const userId = sampleUser?.id;
  const foodId = sampleFood?.id;
  const sellerUserId = sampleFood?.sellerProfile?.userId;
  const planId = sampleMealPlan?.planId || sampleMealPlan?.id;

  console.log('[Test Context]', {
    userId,
    foodId,
    sellerUserId,
    planId,
  });

  const testCases = [
    {
      name: '1. Get User AI Profile (Direct Path)',
      url: `${baseUrl}/internal/ai/users/${userId}/profile`,
      method: 'GET',
    },
    {
      name: '1.1 Get User AI Profile (api/v1 Path)',
      url: `${baseUrl}/api/v1/internal/ai/users/${userId}/profile`,
      method: 'GET',
    },
    {
      name: '1.2 Get User AI Profile (404 Non-existent User)',
      url: `${baseUrl}/internal/ai/users/000000000000000000000000/profile`,
      method: 'GET',
    },
    {
      name: '2. Get Food Candidates',
      url: `${baseUrl}/internal/ai/foods/candidates?user_id=${userId}&limit=10&meal_type=lunch`,
      method: 'GET',
    },
    {
      name: '3. Get Recipe Candidates',
      url: `${baseUrl}/internal/ai/recipes/candidates?user_id=${userId}&limit=10&meal_type=dinner`,
      method: 'GET',
    },
    {
      name: '4. Get Single Food by ID',
      url: `${baseUrl}/internal/ai/foods/${foodId}`,
      method: 'GET',
    },
    {
      name: '4.1 Get Single Food by ID (404 Not Found)',
      url: `${baseUrl}/internal/ai/foods/000000000000000000000000`,
      method: 'GET',
    },
    {
      name: '5. Get Single Recipe by ID',
      url: `${baseUrl}/internal/ai/recipes/${foodId}`,
      method: 'GET',
    },
    {
      name: '6. Get Meal Plan by ID (Valid Ownership -> 200)',
      url: `${baseUrl}/internal/ai/meal-plans/${planId}?user_id=${userId}`,
      method: 'GET',
    },
    {
      name: '6.1 Get Meal Plan by ID (Ownership Mismatch -> 403 Forbidden)',
      url: `${baseUrl}/internal/ai/meal-plans/${planId}?user_id=11111111-1111-1111-1111-111111111111`,
      method: 'GET',
    },
    {
      name: '7. Get Seller Food Draft (Valid Ownership -> 200)',
      url: `${baseUrl}/internal/ai/seller-foods/${foodId}/draft?seller_user_id=${sellerUserId}`,
      method: 'GET',
    },
    {
      name: '7.1 Get Seller Food Draft (Ownership Mismatch -> 403 Forbidden)',
      url: `${baseUrl}/internal/ai/seller-foods/${foodId}/draft?seller_user_id=11111111-1111-1111-1111-111111111111`,
      method: 'GET',
    },
  ];

  const results = [];

  for (const tc of testCases) {
    try {
      const res = await fetch(tc.url, { method: tc.method });
      const status = res.status;
      let body;
      const text = await res.text();
      try {
        body = JSON.parse(text);
      } catch {
        body = text;
      }
      results.push({
        name: tc.name,
        url: tc.url,
        status,
        ok: res.ok || (tc.name.includes('404') && status === 404) || (tc.name.includes('403') && status === 403),
        responseSample: typeof body === 'object' ? JSON.stringify(body).slice(0, 200) + '...' : String(body).slice(0, 100),
        fullBody: body,
      });
    } catch (err: any) {
      results.push({
        name: tc.name,
        url: tc.url,
        status: 'FETCH_ERROR',
        ok: false,
        error: err.message,
      });
    }
  }

  console.log('\n================ TEST SUMMARY ================');
  for (const r of results) {
    const icon = r.ok ? '✅ PASS' : '❌ FAIL';
    console.log(`${icon} [${r.status}] ${r.name}`);
    console.log(`   URL: ${r.url}`);
    if (r.responseSample) console.log(`   Sample: ${r.responseSample}`);
    if (r.error) console.log(`   Error: ${r.error}`);
  }
  console.log('==============================================\n');

  await prisma.$disconnect();
}

testAll().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});

