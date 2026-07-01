import { Hono } from "hono";
import { createSnapshotRoutes } from "./routes/snapshot.js";

export interface CreateAppOptions {
  gitchangeDir: string;
}

export function createApp(options: CreateAppOptions): Hono {
  const app = new Hono();

  app.get("/api/health", (context) => context.json({ ok: true }));
  app.route("/api", createSnapshotRoutes(options));

  return app;
}
