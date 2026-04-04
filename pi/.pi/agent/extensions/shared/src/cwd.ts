import * as fs from "node:fs";

/**
 * Resolve the real CWD, handling Bun's virtual /bunfs/ paths.
 *
 * Bun virtualizes `process.cwd()` into `/bunfs/...` which doesn't exist for
 * subprocesses. This function tries, in order:
 * 1. `PI_REAL_CWD` env var (if set and path exists)
 * 2. `fs.realpathSync(cwd)` (if it resolves to an existing path)
 * 3. `PWD` env var (if set and path exists)
 * 4. `process.cwd()` as final fallback
 */
export function resolveRealCwd(cwd: string): string {
	if (process.env.PI_REAL_CWD && fs.existsSync(process.env.PI_REAL_CWD)) {
		return process.env.PI_REAL_CWD;
	}
	try {
		const real = fs.realpathSync(cwd);
		if (fs.existsSync(real)) return real;
	} catch {
		/* ignore */
	}
	if (process.env.PWD && fs.existsSync(process.env.PWD)) return process.env.PWD;
	return process.cwd();
}
