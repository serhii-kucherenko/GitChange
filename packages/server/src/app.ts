import { Hono } from "hono";
import { createSnapshotRoutes } from "./routes/snapshot.js";
import { wireStatic } from "./static.js";

export interface CreateAppOptions {
  gitchangeDir: string;
  dashboardDistPath?: string;
}

export function createApp(options: CreateAppOptions): Hono {
  const app = new Hono();

  app.get("/api/health", (context) => context.json({ ok: true }));
  app.route("/api", createSnapshotRoutes(options));

  if (options.dashboardDistPath) {
    wireStatic(app, options.dashboardDistPath);
  }

  return app;
}
