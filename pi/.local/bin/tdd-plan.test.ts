/**
 * tdd-plan CLI tests — design command
 *
 * Tests the new `tdd-plan design` command for creating, showing, and editing
 * design artifacts (QRSPI design-artifact phase).
 */
import { afterEach, afterAll, beforeAll, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { execSync } from "node:child_process";

const CLI = join(import.meta.dir, "tdd-plan");
const TEST_DIR = join(import.meta.dir, ".test-plans");

function run(args: string, env?: Record<string, string>) {
	try {
		const result = execSync(`${CLI} ${args}`, {
			cwd: TEST_DIR,
			encoding: "utf8",
			env: { ...process.env, ...env },
			stdio: ["pipe", "pipe", "pipe"],
		});
		return { exitCode: 0, stdout: result, stderr: "" };
	} catch (e: any) {
		return {
			exitCode: e.status ?? 1,
			stdout: e.stdout?.toString() ?? "",
			stderr: e.stderr?.toString() ?? "",
		};
	}
}

function readPlanJson(slug: string) {
	const path = join(TEST_DIR, ".pi", "plans", `${slug}.json`);
	if (!existsSync(path)) return null;
	return JSON.parse(require("fs").readFileSync(path, "utf8"));
}

describe("tdd-plan design", () => {
	beforeAll(() => {
		mkdirSync(join(TEST_DIR, ".pi", "plans"), { recursive: true });
	});

	afterAll(() => {
		if (existsSync(TEST_DIR)) {
			rmSync(TEST_DIR, { recursive: true });
		}
	});

	afterEach(() => {
		// Clean up test plans dir between tests
		const plansDir = join(TEST_DIR, ".pi", "plans");
		if (existsSync(plansDir)) {
			rmSync(plansDir, { recursive: true });
		}
		mkdirSync(plansDir, { recursive: true });
	});

	test("design create: adds design artifact to existing plan", () => {
		// Create a plan first
		run(
			'create auth --title "Auth System" --steps \'[{"name":"Step 1: Token","red":"test jwt","green":"impl jwt","refactor":""}]\'',
		);

		// Add a design artifact
		const result = run(
			'design auth --current-state "No auth middleware exists" --desired-state "JWT-based auth on all routes" --patterns "Express middleware pattern from src/middleware/" --decisions "Use RS256 over HS256" --questions "What about refresh token rotation?"',
		);

		expect(result.exitCode).toBe(0);
		expect(result.stdout).toContain("Design artifact created");

		// Verify the plan JSON has the design fields
		const plan = readPlanJson("auth");
		expect(plan).not.toBeNull();
		expect(plan.design).toBeDefined();
		expect(plan.design.currentState).toBe("No auth middleware exists");
		expect(plan.design.desiredState).toBe("JWT-based auth on all routes");
		expect(plan.design.patterns).toBe("Express middleware pattern from src/middleware/");
		expect(plan.design.decisions).toBe("Use RS256 over HS256");
		expect(plan.design.questions).toBe("What about refresh token rotation?");
	});

	test("design show: displays design artifact for a plan", () => {
		run(
			'create auth --title "Auth System" --steps \'[{"name":"Step 1","red":"test","green":"impl","refactor":""}]\'',
		);
		run(
			'design auth --current-state "No auth" --desired-state "Has auth" --patterns "None" --decisions "JWT" --questions "Refresh tokens?"',
		);

		const result = run("design auth --show");
		expect(result.exitCode).toBe(0);
		expect(result.stdout).toContain("## Design Artifact");
		expect(result.stdout).toContain("No auth");
		expect(result.stdout).toContain("Has auth");
		expect(result.stdout).toContain("JWT");
		expect(result.stdout).toContain("Refresh tokens?");
	});

	test("design edit: updates specific fields of existing design", () => {
		run(
			'create auth --title "Auth" --steps \'[{"name":"Step 1","red":"test","green":"impl","refactor":""}]\'',
		);
		run(
			'design auth --current-state "Old state" --desired-state "Old desired" --patterns "P1" --decisions "D1" --questions "Q1"',
		);

		// Edit just the questions and desired state
		const result = run(
			'design auth --desired-state "Updated desired" --questions "New question? Old question resolved: yes."',
		);

		expect(result.exitCode).toBe(0);
		expect(result.stdout).toContain("Design artifact updated");

		const plan = readPlanJson("auth");
		expect(plan.design.desiredState).toBe("Updated desired");
		expect(plan.design.questions).toBe("New question? Old question resolved: yes.");
		// Unchanged fields stay
		expect(plan.design.currentState).toBe("Old state");
	});

	test("design create without existing plan fails", () => {
		const result = run(
			'design nonexistent --current-state "x" --desired-state "y" --patterns "p" --decisions "d" --questions "q"',
		);
		expect(result.exitCode).not.toBe(0);
		expect(result.stderr).toContain("not found");
	});

	test("design is included in plan show output", () => {
		run(
			'create auth --title "Auth" --steps \'[{"name":"Step 1","red":"test","green":"impl","refactor":""}]\'',
		);
		run(
			'design auth --current-state "No auth" --desired-state "Has auth" --patterns "MW pattern" --decisions "JWT" --questions "Refresh?"',
		);

		const result = run("show auth");
		expect(result.exitCode).toBe(0);
		expect(result.stdout).toContain("## Design Artifact");
		expect(result.stdout).toContain("No auth");
	});
});
