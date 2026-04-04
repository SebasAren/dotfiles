import * as fs from "node:fs";
import * as path from "node:path";

/**
 * Determine how to invoke a pi subprocess.
 *
 * 1. If `process.execPath` is a compiled binary (not node/bun), use it
 *    directly. This is the common case when pi is installed as a Bun
 *    binary — process.argv[1] will be a virtual /$bunfs/ path that
 *    should be ignored.
 * 2. If `process.argv[1]` points to a real file (running as a script
 *    under node/bun), return `{ command: process.execPath, args: [script, ...args] }`.
 * 3. Otherwise, fall back to looking up "pi" in PATH.
 */
export function getPiInvocation(args: string[]): { command: string; args: string[] } {
	const execName = path.basename(process.execPath).toLowerCase();
	const isGenericRuntime = /^(node|bun)(\.exe)?$/.test(execName);

	// Case 1: compiled binary — use directly, ignore argv[1] (may be /$bunfs/...)
	if (!isGenericRuntime) {
		return { command: process.execPath, args };
	}

	// Case 2: running as a script under node/bun with a real script path
	const currentScript = process.argv[1];
	if (currentScript && fs.existsSync(currentScript)) {
		return { command: process.execPath, args: [currentScript, ...args] };
	}

	// Case 3: fallback to PATH lookup
	return { command: "pi", args };
}
