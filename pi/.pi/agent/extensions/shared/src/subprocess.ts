import * as fs from "node:fs";
import * as path from "node:path";

/**
 * Determine how to invoke a pi subprocess.
 *
 * 1. If `process.argv[1]` points to a real file (running as a script),
 *    return `{ command: process.execPath, args: [script, ...args] }`.
 * 2. If `process.execPath` is a generic runtime (node/bun), return
 *    `{ command: "pi", args }`.
 * 3. Otherwise (e.g. running as a compiled binary), return
 *    `{ command: process.execPath, args }`.
 */
export function getPiInvocation(args: string[]): { command: string; args: string[] } {
	const currentScript = process.argv[1];
	if (currentScript && fs.existsSync(currentScript)) {
		return { command: process.execPath, args: [currentScript, ...args] };
	}
	const execName = path.basename(process.execPath).toLowerCase();
	const isGenericRuntime = /^(node|bun)(\.exe)?$/.test(execName);
	if (!isGenericRuntime) {
		return { command: process.execPath, args };
	}
	return { command: "pi", args };
}
