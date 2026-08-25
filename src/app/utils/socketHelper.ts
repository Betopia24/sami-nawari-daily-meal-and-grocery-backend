import { Server as HttpServer } from "http";
import { Server, Socket } from "socket.io";
import { createAdapter } from "@socket.io/redis-adapter";
import { pubClient, subClient } from "./redisClient";
import { jwtHelper } from "./JwtHelper";
import config from "../config";

let io: Server | null = null;

export const initializeSocket = (server: HttpServer) => {
  io = new Server(server, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
      credentials: true,
    },
  });

  // Attach Redis adapter for horizontal scaling
  io.adapter(createAdapter(pubClient, subClient));

  io.use(async (socket: Socket, next) => {
    try {
      let token =
        socket.handshake.auth?.token ||
        socket.handshake.headers?.authorization ||
        socket.handshake.headers?.token;

      if (!token) {
        return next(new Error("Authentication error: Token missing"));
      }

      if (typeof token === "string" && token.startsWith("Bearer ")) {
        token = token.split(" ")[1];
      }

      const decoded = jwtHelper.verifyToken(
        token,
        config.jwt.accessToken as string
      ) as any;

      if (!decoded) {
        return next(new Error("Authentication error: Invalid token"));
      }

      socket.data.user = decoded; // Contains userId and role
      next();
    } catch (err) {
      next(new Error("Authentication error: Unauthorized"));
    }
  });

  io.on("connection", (socket: Socket) => {
    const userId = socket.data.user?.userId;
    if (userId) {
      // Join a user-specific room to route messages to all connections of this user
      socket.join(`user:${userId}`);
      console.log(`🔌 Socket ${socket.id} connected for user:${userId}`);
    }

    socket.on("disconnect", () => {
      console.log(`🔌 Socket ${socket.id} disconnected`);
    });
  });

  return io;
};

export const getIo = (): Server => {
  if (!io) {
    throw new Error("Socket.io is not initialized yet!");
  }
  return io;
};

// Send real-time notification to a user room across all instances
export const emitToUser = (userId: string, eventName: string, data: any) => {
  if (io) {
    io.to(`user:${userId}`).emit(eventName, data);
    return true;
  }
  return false;
};

// Send real-time notification to multiple users
export const emitToUsers = (userIds: string[], eventName: string, data: any) => {
  userIds.forEach((userId) => {
    emitToUser(userId, eventName, data);
  });
};
