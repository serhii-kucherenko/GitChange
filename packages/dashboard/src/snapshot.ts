import type {
  IndexCompleteness,
  ManifestWarningCode,
  SnapshotResponse,
} from "./types.js";

export function assertNever(value: never): never {
  throw new Error(`Unexpected value: ${JSON.stringify(value)}`);
}

export function formatWarningCode(code: ManifestWarningCode): string {
  switch (code) {
    case "shallow_clone":
      return "Shallow clone";
    case "force_push_detected":
      return "Force push detected";
    case "out_of_order_commits":
      return "Out-of-order commits";
    default:
      return assertNever(code);
  }
}

export function formatIndexCompleteness(value: IndexCompleteness): string {
  switch (value) {
    case "complete":
      return "Complete";
    case "partial":
      return "Partial";
    default:
      return assertNever(value);
  }
}

export type SnapshotLoadState =
  | { status: "loading" }
  | { status: "empty" }
  | { status: "error"; message: string }
  | { status: "ready"; data: SnapshotResponse };

export async function fetchSnapshot(): Promise<SnapshotLoadState> {
  const response = await fetch("/api/snapshot");

  if (response.status === 404) {
    return { status: "empty" };
  }

  if (!response.ok) {
    return {
      status: "error",
      message: `Snapshot request failed (${response.status})`,
    };
  }

  const data = (await response.json()) as SnapshotResponse;
  return { status: "ready", data };
}
