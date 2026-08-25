import Redis from "ioredis";
import config from "../config";

const redis = new Redis({
  host: config.redis.host,
  port: config.redis.port,
  username: config.redis.username,
  password: config.redis.password,
  maxRetriesPerRequest: null,
});

redis.on("connect", () => {
  console.log("🚀 Connecting to Redis...");
});

redis.on("ready", () => {
  console.log("✅ Redis client is ready");
});

redis.on("error", (err) => {
  console.error("❌ Redis Client Connection Error:", err);
});

export default redis;
