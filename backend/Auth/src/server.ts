import dotenv from "dotenv";
import path from "path";

import { buildApp } from "./app.js";
import { readConfigValue } from "./utils/env.js";
import { setupSocketIO } from "./socket/index.js";
import { CONFIG } from "./game/config.js";

dotenv.config({ path: path.resolve(process.cwd(), ".env") });

const JWT_SECRET = readConfigValue("JWT_SECRET");
if (!JWT_SECRET) {
  console.error("FATAL: JWT_SECRET is not defined. Authentication will not work.");
  process.exit(1);
}
process.env.JWT_SECRET = JWT_SECRET;

const start = async () => {
  try {
    const port = Number(process.env.PORT ?? CONFIG.PORT);
    const app = buildApp();

    await app.ready();
    console.log("Registered routes:");
    console.log(app.printRoutes());

    const httpServer = app.server;
    const { io, getRuntimeMetrics } = setupSocketIO(httpServer);
    app.io = io;
    app.getRealtimeMetrics = getRuntimeMetrics;

    await app.listen({ port, host: "0.0.0.0" });

    console.log(`Server running on port ${port}`);
  } catch (err) {
    console.error("Server failed to start:", err);
    process.exit(1);
  }
};

start();
