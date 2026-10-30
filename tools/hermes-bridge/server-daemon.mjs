import http from "node:http";
import next from "next";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "../..");

const port = parseInt(process.env.PORT || "3000", 10);
const hostname = "0.0.0.0";

const app = next({
  dev: false,
  dir: rootDir,
  hostname,
  port,
});

const handle = app.getRequestHandler();

console.log(`[OpenNova Daemon] Preparing Next.js in ${rootDir}...`);

app.prepare().then(() => {
  const server = http.createServer(async (req, res) => {
    try {
      await handle(req, res);
    } catch (err) {
      console.error("[OpenNova Daemon] Request error:", err);
      res.statusCode = 500;
      res.end("Internal Server Error");
    }
  });

  server.listen(port, hostname, () => {
    console.log(`[OpenNova Daemon] Ready and listening on http://${hostname}:${port}`);
  });

  // Keep process open
  process.on("SIGTERM", () => {
    console.log("[OpenNova Daemon] SIGTERM received, closing...");
    server.close(() => process.exit(0));
  });

  process.on("SIGINT", () => {
    console.log("[OpenNova Daemon] SIGINT received, closing...");
    server.close(() => process.exit(0));
  });
}).catch((err) => {
  console.error("[OpenNova Daemon] Failed to prepare app:", err);
  process.exit(1);
});
