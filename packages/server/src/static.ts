import { serveStatic } from "@hono/node-server/serve-static";
import type { Hono } from "hono";

export function wireStatic(app: Hono, dashboardDistPath: string): void {
  app.use(
    "/*",
    serveStatic({
      root: dashboardDistPath,
    }),
  );

  app.get(
    "*",
    serveStatic({
      root: dashboardDistPath,
      path: "index.html",
    }),
  );
}
