import http, { Server } from "http";
import app from "./app";
import config from "./app/config";
import { seedAdmin } from "./app/utils/seedAdmin";
import initializeFirebase from "./app/utils/firebase";
import { initializeSocket } from "./app/utils/socketHelper";
import { startOutboxScheduler } from "./app/jobs/outboxWorker";
import { prisma } from "./app/prisma/prisma";

// Import workers to ensure they start listening to queues
import "./app/jobs/outboxWorker";
import "./app/jobs/emailWorker";
import "./app/jobs/fcmWorker";
import "./app/jobs/socketWorker";

async function ensureGeospatialIndex() {
    try {
        await prisma.$runCommandRaw({
            createIndexes: "seller_profiles",
            indexes: [
                {
                    key: { location: "2dsphere" },
                    name: "location_2dsphere",
                },
            ],
        });
        console.log("✅ Geospatial 2dsphere index verified/created for seller_profiles.");
    } catch (error) {
        console.error("⚠️ Failed to create/verify Geospatial index:", error);
    }
}

async function bootstrap() {
    let server: Server;

    try {
        initializeFirebase();
        server = http.createServer(app);

        // Initialize Socket.io with Redis Adapter
        initializeSocket(server);

        // Start Outbox repeatable cron poller
        await startOutboxScheduler();

        // Ensure 2dsphere index is created in MongoDB
        await ensureGeospatialIndex();

        server.listen(config.port, () => {
            console.log(`🚀 Server is running on http://localhost:${config.port}`);
        });

        const exitHandler = () => {
            if (server) {
                server.close(() => {
                    console.log("Server closed gracefully.");
                    process.exit(1);
                });
            } else {
                process.exit(1);
            }
        };

        process.on("unhandledRejection", (error) => {
            console.log("Unhandled Rejection detected, shutting down...");
            console.error(error);
            exitHandler();
        });

        process.on("SIGTERM", exitHandler);
        process.on("SIGINT", exitHandler);

    } catch (error) {
        console.error("Error during server startup:", error);
        process.exit(1);
    }
}

(async () => {
    await bootstrap()
    await seedAdmin()
}
)();
