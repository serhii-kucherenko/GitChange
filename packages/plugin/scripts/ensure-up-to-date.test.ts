import {
  existsSync,
  lstatSync,
  mkdtempSync,
  mkdirSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { DEFAULT_INSTALL_DIR, shouldAutoUpdate } from "./ensure-up-to-date.js";

describe("shouldAutoUpdate", () => {
  const envRestore = {
    skip: process.env.GITCHANGE_SKIP_UPDATE,
    dev: process.env.GITCHANGE_DEV,
  };
  let tempGlobal: string | null = null;
  let hadGlobalInstall = false;
  let savedGlobalPath: string | null = null;

  afterEach(() => {
    if (envRestore.skip === undefined) {
      delete process.env.GITCHANGE_SKIP_UPDATE;
    } else {
      process.env.GITCHANGE_SKIP_UPDATE = envRestore.skip;
    }
    if (envRestore.dev === undefined) {
      delete process.env.GITCHANGE_DEV;
    } else {
      process.env.GITCHANGE_DEV = envRestore.dev;
    }
    if (tempGlobal) {
      rmSync(tempGlobal, { recursive: true, force: true });
      tempGlobal = null;
    }
    if (hadGlobalInstall) {
      rmSync(DEFAULT_INSTALL_DIR, { recursive: true, force: true });
      if (savedGlobalPath && existsSync(savedGlobalPath) && savedGlobalPath !== tempGlobal) {
        try {
          symlinkSync(savedGlobalPath, DEFAULT_INSTALL_DIR);
        } catch {
          // best-effort restore
        }
      }
    }
    hadGlobalInstall = false;
    savedGlobalPath = null;
  });

  it("returns false when GITCHANGE_SKIP_UPDATE is set", () => {
    process.env.GITCHANGE_SKIP_UPDATE = "1";
    expect(shouldAutoUpdate(DEFAULT_INSTALL_DIR)).toBe(false);
  });

  it("returns false when GITCHANGE_DEV is set", () => {
    process.env.GITCHANGE_DEV = "1";
    expect(shouldAutoUpdate(DEFAULT_INSTALL_DIR)).toBe(false);
  });

  it("returns false for a dev checkout that is not the global install dir", () => {
    tempGlobal = mkdtempSync(join(tmpdir(), "gitchange-dev-"));
    makePluginRoot(tempGlobal);
    expect(shouldAutoUpdate(tempGlobal)).toBe(false);
  });

  it("returns true when root matches the global install directory", () => {
    tempGlobal = mkdtempSync(join(tmpdir(), "gitchange-global-"));
    makePluginRoot(tempGlobal);

    if (existsSync(DEFAULT_INSTALL_DIR)) {
      hadGlobalInstall = true;
      try {
        savedGlobalPath = lstatSync(DEFAULT_INSTALL_DIR).isSymbolicLink()
          ? realpathSync(DEFAULT_INSTALL_DIR)
          : DEFAULT_INSTALL_DIR;
      } catch {
        savedGlobalPath = DEFAULT_INSTALL_DIR;
      }
      rmSync(DEFAULT_INSTALL_DIR, { recursive: true, force: true });
    }

    symlinkSync(tempGlobal, DEFAULT_INSTALL_DIR);
    const resolved = realpathSync(DEFAULT_INSTALL_DIR);
    expect(shouldAutoUpdate(resolved)).toBe(true);
  });
});

function makePluginRoot(base: string): void {
  mkdirSync(join(base, ".cursor-plugin"), { recursive: true });
  writeFileSync(
    join(base, ".cursor-plugin", "plugin.json"),
    JSON.stringify({ name: "gitchange" }),
  );
}
