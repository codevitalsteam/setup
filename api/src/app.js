import express from "express";
import path from "path";
import { router } from "./route.js";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function createApp() {
  const app = express();
  app.use(express.json({ limit: "5mb" }));

  app.use("/api", router);

  // PROD: serve React build
  const webDist = path.resolve(__dirname, "../../web/dist");
  app.use(express.static(webDist));

  // 404
  app.use((req, res) => res.status(404).json({ error: "not_found", path: req.path }));

  // SPA fallback (React Router)
  app.get("*", (_req, res) => {
    res.sendFile(path.join(webDist, "index.html"));
  });

  // error handler
  app.use((err, _req, res, _next) => {
    const status = err.status || 500;
    res.status(status).json({ error: err.message || "internal_error" });
  });

  return app;
}