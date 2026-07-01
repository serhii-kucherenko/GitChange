import { type ServerType, serve } from "@hono/node-server";
import { createApp } from "./app.js";

export interface StartServerOptions {
  /** Primary workspace .gitchange directory (workspace.json lives here when federated). */
  gitchangeDir: string;
  host?: string;
  port?: number;
  dashboardDistPath?: string;
}

export interface StartedServer {
  server: ServerType;
  host: string;
  port: number;
  url: string;
}

export function startServer(options: StartServerOptions): StartedServer {
  const host = options.host ?? "127.0.0.1";
  const port =
    options.port ?? Number.parseInt(process.env.GITCHANGE_PORT ?? "9876", 10);

  if (host === "0.0.0.0") {
    console.warn(
      "gitchange: binding to 0.0.0.0 exposes the API on all interfaces (unsafe on shared machines).",
    );
  }

  const app = createApp({
    gitchangeDir: options.gitchangeDir,
    dashboardDistPath: options.dashboardDistPath,
  });
  const url = `http://${host}:${port}`;

  const server = serve(
    {
      fetch: app.fetch,
      hostname: host,
      port,
    },
    (info) => {
      console.log(
        `GitChange API listening at http://${info.address}:${info.port}`,
      );
    },
  );

  return { server, host, port, url };
}
