import Redis from "ioredis";
import dotenv from "dotenv";

dotenv.config();

const redis = new Redis({
  host: process.env.REDIS_HOST,
  port: Number(process.env.REDIS_PORT) || 6379,
  username: process.env.REDIS_USERNAME || undefined,
  password: process.env.REDIS_PASSWORD || undefined,
});

async function main() {
  console.log("📡 Connecting to remote Redis database...");
  
  try {
    // Find all keys in Redis
    const keys = await redis.keys("*");
    console.log(`📝 Found ${keys.length} total key(s) in Redis:\n`);

    const carts: string[] = [];
    const publishedFoodCaches: string[] = [];
    const foodDetailsCaches: string[] = [];
    const otherKeys: string[] = [];

    for (const key of keys) {
      if (key.startsWith("cart:")) {
        carts.push(key);
      } else if (key.startsWith("published_foods:")) {
        publishedFoodCaches.push(key);
      } else if (key.startsWith("food_details:")) {
        foodDetailsCaches.push(key);
      } else {
        otherKeys.push(key);
      }
    }

    // 1. Process Carts
    console.log(`🛒 --- Active Carts (${carts.length}) ---`);
    const foodQuantities: Record<string, number> = {};
    let totalItemsCount = 0;

    for (const key of carts) {
      const data = await redis.hgetall(key);
      console.log(`🔑 Key: "${key}"`);
      console.log("📦 Cart Items (foodId -> quantity):");
      console.log(JSON.stringify(data, null, 2));
      console.log("───────────────────────────────────");

      for (const [foodId, quantityStr] of Object.entries(data)) {
        const qty = Number(quantityStr) || 0;
        foodQuantities[foodId] = (foodQuantities[foodId] || 0) + qty;
        totalItemsCount += qty;
      }
    }

    // 2. Process Published Foods Cache
    console.log(`\n🍎 --- Published Foods Cache (${publishedFoodCaches.length}) ---`);
    for (const key of publishedFoodCaches) {
      const ttl = await redis.ttl(key);
      console.log(`🔑 Key: "${key}" (TTL: ${ttl}s)`);
    }

    // 3. Process Food Details Cache
    console.log(`\n📄 --- Food Details Cache (${foodDetailsCaches.length}) ---`);
    for (const key of foodDetailsCaches) {
      const ttl = await redis.ttl(key);
      console.log(`🔑 Key: "${key}" (TTL: ${ttl}s)`);
    }

    // 4. Other keys
    if (otherKeys.length > 0) {
      console.log(`\n❓ --- Other Keys (${otherKeys.length}) ---`);
      for (const key of otherKeys) {
        const ttl = await redis.ttl(key);
        console.log(`🔑 Key: "${key}" (TTL: ${ttl}s)`);
      }
    }

    console.log("\n📊 --- REDIS SUMMARY ---");
    console.log(`🛒 Active Carts: ${carts.length}`);
    console.log(`🍎 Published Foods Cache Lists: ${publishedFoodCaches.length}`);
    console.log(`📄 Food Details Caches: ${foodDetailsCaches.length}`);
    console.log(`🔢 Total Cart Items Quantity: ${totalItemsCount}`);
    console.log("────────────────────────\n");

  } catch (error) {
    console.error("❌ Failed to query Redis:", error);
  } finally {
    await redis.disconnect();
    console.log("🔌 Disconnected from Redis.");
  }
}

main();
