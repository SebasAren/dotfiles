---
name: tdd-implement
description: Executes a TDD implementation plan created by the tdd-plan skill. Follows the Red-Green-Refactor cycle step-by-step, running tests at each phase. Use when you have a plan in .pi/plans/ and want to implement it.
---

# TDD Plan Implementer

Execute an existing TDD implementation plan step-by-step. Each step follows the strict Red-Green-Refactor discipline: write a failing test, make it pass with minimal code, then refactor if needed.

## Process

When this skill is invoked:

1. **Locate the plan.** Read the plan file from `.pi/plans/<slug>.md`. If no slug is provided, list available plans and ask which one to implement.
2. **Confirm the plan.** Show the plan summary table and ask for confirmation before starting.
3. **Execute each step** in order, following the Red-Green-Refactor cycle below.
4. **Update progress** by checking off completed steps in the plan file.

## Red-Green-Refactor Cycle

For each step in the plan, execute these three phases **in strict order**:

### 🔴 RED — Write the failing test

- **Update progress:** Set Status to `Step N/M — 🔴 RED`, mark the RED cell 🔄 in the Progress Log table.
- Read the step's RED section for the test description.
- Write the test file or add the test case to the existing test file.
- Run the test suite to **confirm the test fails** with the expected error.
- If the test passes or fails with an unexpected error, stop and report the issue. Do not proceed to GREEN.
- **Update progress:** Mark the RED cell ✅ in the Progress Log table.
- Output the failing test output for the user to see.

### 🟢 GREEN — Make it pass

- **Update progress:** Set Status to `Step N/M — 🟢 GREEN`, mark the GREEN cell 🔄 in the Progress Log table.
- Read the step's GREEN section for the minimal implementation.
- Write the **simplest code** that makes the test pass. No gold-plating, no speculative abstractions.
- Run the test suite to **confirm the test passes**.
- If the test still fails, iterate on the implementation — but stay minimal. Do not add extra features.
- **Update progress:** Mark the GREEN cell ✅ in the Progress Log table.
- Output the passing test output for the user to see.

### 🔵 REFACTOR — Clean up (if applicable)

- **Update progress:** Set Status to `Step N/M — 🔵 REFACTOR`, mark the REFACTOR cell 🔄 in the Progress Log table. If skipping, mark it ⏭️ instead and update Status to `Step N/M — ✅ Complete`.
- Read the step's REFACTOR section. Skip this phase entirely if the section says to skip or is empty.
- Apply the described refactoring while keeping all tests green.
- Run the **full** test suite (not just the current test) to confirm nothing broke.
- If any test fails, revert the refactoring and try again.
- **Update progress:** Mark the REFACTOR cell ✅ in the Progress Log table.
- Output the full test suite result.

## User Verification

After completing each step (the full Red-Green-Refactor cycle), **pause and ask the user to verify** before proceeding to the next step. Show:

1. A brief summary of what was done (test written, implementation added, refactoring applied).
2. The final test output.
3. The git commit that was made.

Then ask: "Step N/M complete. Continue to the next step?" Do not proceed until the user confirms. If the user requests changes, address them and re-verify before moving on.

## Progress Tracking

Update the plan file's Progress Log section **at every phase transition**, not just at step boundaries. This ensures that if the session is interrupted, the plan file always accurately reflects what has been completed.

### When to update

Update the plan file immediately after **each** of these events:

1. **After confirming a failing test in RED** — mark the RED cell ✅ for that step, update the Status line.
2. **After confirming a passing test in GREEN** — mark the GREEN cell ✅, update the Status line.
3. **After completing REFACTOR** (or skipping it) — mark the REFACTOR cell ✅, update the Status line.
4. **After user confirms the step** — mark the step title with ~~strikethrough~~ ✅.

### Status line

Keep a `**Status:**` line at the top of the Progress Log that always reflects the current state:

```
**Status:** Step 2/5 — 🟢 GREEN (writing minimal implementation)
```

Update this line at every phase transition. Use these patterns:
- `Not started`
- `Step N/M — 🔴 RED (writing failing test)`
- `Step N/M — 🟢 GREEN (writing minimal implementation)`
- `Step N/M — 🔵 REFACTOR (cleaning up)`
- `Step N/M — ✅ Complete`
- `All steps complete ✅`

### Progress Log table format

Each row tracks the three phases independently:

```markdown
| Step | 🔴 RED | 🟢 GREEN | 🔵 REFACTOR |
|------|--------|----------|-------------|
| 1 | ✅ | ✅ | ✅ |
| 2 | ✅ | 🔄 | ⬜ |   ← currently in GREEN phase
| 3 | ⬜ | ⬜ | ⬜ |
```

Use these markers:
- ⬜ Not started
- 🔄 In progress
- ✅ Done
- ⏭️ Skipped (refactor phase only)

### Step title marking

After the user confirms a full step is complete, also update the step heading:

```markdown
### ~~Step 1: [Step Name]~~ ✅
```

### Example: full progression for one step

1. Start RED: update Status to `Step 1/3 — 🔴 RED`, mark RED cell 🔄
2. RED test confirmed failing: mark RED cell ✅
3. Start GREEN: update Status to `Step 1/3 — 🟢 GREEN`, mark GREEN cell 🔄
4. GREEN test confirmed passing: mark GREEN cell ✅
5. Start REFACTOR: update Status to `Step 1/3 — 🔵 REFACTOR`, mark REFACTOR cell 🔄
6. REFACTOR complete: mark REFACTOR cell ✅ (or ⏭️ if skipped)
7. User confirms step: update Status to `Step 1/3 — ✅ Complete`, strike through step title
8. Move to next step

## Rules

1. **Never skip RED.** Do not write implementation before writing and confirming a failing test.
2. **Never skip GREEN.** Do not move to the next step until the current test passes.
3. **Minimal GREEN only.** The implementation should be the simplest code that passes. Resist the urge to add error handling, abstractions, or features not demanded by the test.
4. **Real refactoring only.** Only refactor when the plan explicitly calls for it. Do not "improve" code that the plan doesn't flag.
5. **Run tests after every phase.** RED → run tests → GREEN → run tests → REFACTOR → run full suite.
6. **Stop on unexpected failure.** If a test fails in an unexpected way (compilation error, wrong test framework, missing dependency), stop and explain the problem. Ask the user how to proceed.
7. **One step at a time.** Complete the full Red-Green-Refactor cycle for one step before starting the next. Never work on two steps simultaneously.
8. **Respect the plan.** If you discover the plan is wrong or incomplete, pause and discuss with the user rather than silently deviating.
9. **Commit after each step.** After completing a full Red-Green-Refactor cycle, commit the changes with a descriptive message following conventional commits format. Example: `feat(auth): add JWT token generation (step 1/N)`.

## Test Commands

Before starting, determine how to run tests in the project:

- **Node.js:** Check `package.json` for `"test"` script. Common: `npm test`, `npx vitest`, `npx jest`.
- **Python:** Check `pyproject.toml` or `setup.cfg`. Common: `pytest`, `python -m pytest`.
- **Go:** `go test ./...`
- **Rust:** `cargo test`
- **Ruby:** `bundle exec rspec`
- **Other:** Look at Makefile, justfile, or ask the user.

If you cannot determine the test command, ask the user before proceeding.

## Error Handling

- **Test framework not found:** Stop and ask the user to install or configure the test framework.
- **Unexpected test pass in RED:** The test may not be asserting the right thing, or the feature may already exist. Report and ask.
- **Cannot make GREEN pass after 3 attempts:** Stop and explain. Suggest simplifying the test or splitting the step.
- **Refactoring breaks tests:** Revert immediately. Report and ask whether to skip the refactoring or take a different approach.

## Usage

```
/skill:tdd-implement <plan-slug>
/skill:tdd-implement user-jwt-auth
/skill:tdd-implement                # lists available plans
```
