import { Hono } from "hono";
import { createCommitDetailRoutes } from "./routes/commit-detail.js";
import { createCommitsRoutes } from "./routes/commits.js";
import { createDecisionsRoutes } from "./routes/decisions.js";
import { createErasRoutes } from "./routes/eras.js";
import { createGraphRoutes } from "./routes/graph.js";
import { createFileHistoryRoutes } from "./routes/file-history.js";
import { createOpenWorkRoutes } from "./routes/open-work.js";
import { createSnapshotRoutes } from "./routes/snapshot.js";
import { createToursRoutes } from "./routes/tours.js";
import { createWorkspaceRoutes } from "./routes/workspace.js";
import { wireStatic } from "./static.js";

export interface CreateAppOptions {
  gitchangeDir: string;
  dashboardDistPath?: string;
}

export function createApp(options: CreateAppOptions): Hono {
  const app = new Hono();

  app.get("/api/health", (context) => context.json({ ok: true }));
  app.route("/api", createSnapshotRoutes(options));
  app.route("/api", createCommitsRoutes(options));
  app.route("/api", createErasRoutes(options));
  app.route("/api", createCommitDetailRoutes(options));
  app.route("/api", createFileHistoryRoutes(options));
  app.route("/api", createDecisionsRoutes(options));
  app.route("/api", createOpenWorkRoutes(options));
  app.route("/api", createToursRoutes(options));
  app.route("/api", createGraphRoutes(options));
  app.route("/api", createWorkspaceRoutes(options));

  if (options.dashboardDistPath) {
    wireStatic(app, options.dashboardDistPath);
  }

  return app;
}
