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
    // Find all keys matching "cart:*"
    const keys = await redis.keys("cart:*");
    console.log(`📝 Found ${keys.length} active cart key(s):\n`);

    for (const key of keys) {
      const data = await redis.hgetall(key);
      console.log(`🔑 Key: "${key}"`);
      console.log("📦 Cart Items (foodId -> quantity):");
      console.log(JSON.stringify(data, null, 2));
      console.log("───────────────────────────────────");
    }
  } catch (error) {
    console.error("❌ Failed to query Redis:", error);
  } finally {
    await redis.disconnect();
    console.log("🔌 Disconnected from Redis.");
  }
}

main();
