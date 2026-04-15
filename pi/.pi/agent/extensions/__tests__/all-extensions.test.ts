import { describe, it, expect } from "bun:test";
import { spawn } from "node:child_process";

/**
 * Top-level verification that all extensions and the shared package
 * pass their test suites. This runs `bun test` in each directory
 * and verifies exit code 0.
 */
describe("all extensions verification", () => {
  const extensionDirs = [
    "shared",
    "explore",
    "librarian",
    "worktree-scope",
    "fuzzy-edit",
    "plan-mode",
    "tdd-tree",
  ];

  for (const dir of extensionDirs) {
    it(`${dir}: all tests pass`, async () => {
      const exitCode = await new Promise<number>((resolve) => {
        const proc = spawn("bun", ["test"], {
          cwd: import.meta.dir + "/../" + dir,
          shell: false,
          stdio: ["ignore", "pipe", "pipe"],
        });
        let stdout = "";
        let stderr = "";
        proc.stdout.on("data", (d) => (stdout += d.toString()));
        proc.stderr.on("data", (d) => (stderr += d.toString()));
        proc.on("close", (code) => {
          if (code !== 0) {
            console.log(`[${dir}] stdout:\n${stdout}`);
            console.log(`[${dir}] stderr:\n${stderr}`);
          }
          resolve(code ?? 1);
        });
        proc.on("error", () => resolve(1));
      });
      expect(exitCode).toBe(0);
    });
  }

  it("all extensions depend on @pi-ext/shared (except unchanged ones)", async () => {
    const expectedDeps = ["explore", "librarian"];
    for (const ext of expectedDeps) {
      const pkg = await import(`../${ext}/package.json`);
      expect(pkg.dependencies?.["@pi-ext/shared"]).toBe("workspace:*");
    }
  });
});
