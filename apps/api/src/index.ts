import "./config/env.js";

import { startApiServer } from "./server.js";

startApiServer().catch((error: unknown) => {
  console.error("Failed to start CleanHub API", error);
  process.exit(1);
});
