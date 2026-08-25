import Redis from "ioredis";
import config from "../config";

export const redisConnectionConfig = {
  host: config.redis.host,
  port: config.redis.port,
  username: config.redis.username,
  password: config.redis.password,
  maxRetriesPerRequest: null,
};

const redis = new Redis(redisConnectionConfig);

redis.on("connect", () => {
  console.log("🚀 Connecting to Redis...");
});

redis.on("ready", () => {
  console.log("✅ Redis client is ready");
});

redis.on("error", (err) => {
  console.error("❌ Redis Client Connection Error:", err);
});

export const createRedisClient = () => {
  return new Redis(redisConnectionConfig);
};

// Dedicated duplicate connections for Socket.io Redis Adapter
// Using separate connections prevents interference with the main app redis client
export const pubClient = redis.duplicate();
export const subClient = redis.duplicate();

export default redis;
