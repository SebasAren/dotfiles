import { spawnSync } from "child_process";

/**
 * Copy a PNG buffer to the system clipboard.
 *
 * Tries Wayland (wl-copy), then X11 (xclip), then macOS (pbcopy).
 *
 * @param png - The PNG image buffer to copy
 * @throws If no clipboard utility is available or returns a non-zero exit code
 */
export function copyToClipboard(png: Buffer): void {
  for (const { cmd, args } of [
    { cmd: "wl-copy", args: ["--type", "image/png"] },
    { cmd: "xclip", args: ["-selection", "clipboard", "-t", "image/png"] },
    // Best-effort fallback on macOS; pbcopy does not set image MIME type via CLI
    { cmd: "pbcopy", args: [] },
  ]) {
    const result = spawnSync(cmd, args, {
      input: png,
      stdio: ["pipe", "pipe", "pipe"],
    });

    if (result.error) {
      // Binary not found — try next fallback
      continue;
    }

    if (result.signal) {
      throw new Error(`${cmd} was killed by signal ${result.signal}`);
    }

    if (result.status !== 0) {
      const stderr = result.stderr?.toString() ?? "";
      throw new Error(`${cmd} failed (exit ${result.status}): ${stderr}`);
    }

    return; // success
  }

  throw new Error(
    "No clipboard utility found. Install one of: wl-copy (wl-clipboard), xclip, or pbcopy.",
  );
}
