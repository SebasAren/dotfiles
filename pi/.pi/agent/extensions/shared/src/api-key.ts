/**
 * API key helpers for extensions that require external API keys.
 *
 * Provides a soft check (warn + return undefined) and a hard require
 * (throw on missing) pattern used by exa-search, context7, and future
 * API-backed extensions.
 */

/**
 * Check for an API key, log a warning if missing, return key or undefined.
 *
 * Use during extension initialization to warn early but allow registration.
 */
export function checkApiKey(name: string, envVar: string): string | undefined {
	const key = process.env[envVar];
	if (!key) {
		console.warn(
			`[${name}] ${envVar} not set. Tool will not work. Set it via: export ${envVar}='your-key'`,
		);
	}
	return key;
}

/**
 * Assert an API key is present, throwing a helpful error if not.
 *
 * Use inside tool execute() when the key is actually needed.
 */
export function requireApiKey(name: string, envVar: string): string {
	const key = process.env[envVar];
	if (!key) {
		throw new Error(
			`${envVar} not set. Set it via: export ${envVar}='your-key'`,
		);
	}
	return key;
}
