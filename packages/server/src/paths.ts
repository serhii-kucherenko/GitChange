import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const serverDir = dirname(fileURLToPath(import.meta.url));

/** Resolve dashboard dist from installed @gitchange/server package layout. */
export function resolveDashboardDist(): string {
  return join(serverDir, "../../dashboard/dist");
}
