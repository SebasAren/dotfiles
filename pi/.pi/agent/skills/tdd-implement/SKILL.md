---
name: tdd-implement
description: Executes a TDD implementation plan created by the tdd-plan skill. Follows the Red-Green-Refactor cycle step-by-step, running tests at each phase. Use when you have a plan in .pi/plans/ and want to implement it.
---

# TDD Plan Implementer

Execute an existing TDD implementation plan step-by-step. Each step follows the strict Red-Green-Refactor discipline: write a failing test, make it pass with minimal code, then refactor if needed.

## Process

When this skill is invoked:

1. **Locate the plan.** Run `tdd-plan show <slug>` to display the plan. If no slug is provided, run `tdd-plan list` to show available plans and ask which one to implement.
2. **Confirm the plan.** Show the plan summary and ask for confirmation before starting.
3. **Execute each step** in order, following the Red-Green-Refactor cycle below.
4. **Update progress** using `tdd-plan phase` and `tdd-plan complete` commands after each phase transition.
5. **Archive the plan.** After all steps are complete and confirmed by the user, run `tdd-plan archive <slug>`.

## CLI Reference

```bash
tdd-plan show <slug>                                        # Show plan with current progress
tdd-plan phase <slug> <step> <red|green|refactor> <start|done|skip>  # Update phase
tdd-plan complete <slug> <step>                             # Mark step fully complete
tdd-plan note <slug> <text>                                 # Add a note
tdd-plan archive <slug>                                     # Archive completed plan
```

## Red-Green-Refactor Cycle

For each step in the plan, execute these three phases **in strict order**:

### 🔴 RED — Write the failing test

- **Update progress:** `tdd-plan phase <slug> <step> red start`
- Read the step's RED description from `tdd-plan show <slug>`.
- Write the test file or add the test case to the existing test file.
- Run the test suite to **confirm the test fails** with the expected error.
- If the test passes or fails with an unexpected error, stop and report the issue. Do not proceed to GREEN.
- **Update progress:** `tdd-plan phase <slug> <step> red done`
- Output the failing test output for the user to see.

### 🟢 GREEN — Make it pass

- **Update progress:** `tdd-plan phase <slug> <step> green start`
- Read the step's GREEN description from `tdd-plan show <slug>`.
- Write the **simplest code** that makes the test pass. No gold-plating, no speculative abstractions.
- Run the test suite to **confirm the test passes**.
- If the test still fails, iterate on the implementation — but stay minimal. Do not add extra features.
- **Update progress:** `tdd-plan phase <slug> <step> green done`
- Output the passing test output for the user to see.

### 🔵 REFACTOR — Clean up (if applicable)

- Read the step's REFACTOR description from `tdd-plan show <slug>`. Skip this phase entirely if the description is empty.
- **Update progress:** `tdd-plan phase <slug> <step> refactor start` (or `skip` if no refactoring needed)
- Apply the described refactoring while keeping all tests green.
- Run the **full** test suite (not just the current test) to confirm nothing broke.
- If any test fails, revert the refactoring and try again.
- **Update progress:** `tdd-plan phase <slug> <step> refactor done` (or `skip` was already called)
- Output the full test suite result.

## User Verification

After completing each step (the full Red-Green-Refactor cycle), **commit using the commit skill** (`/skill:commit`) with a message like `feat(<scope>): <description> (step N/M)`. The commit skill will handle reflection, rules updates, and the actual commit.

After committing, **mark the step complete** and **pause and ask the user to verify** before proceeding to the next step:

```bash
tdd-plan complete <slug> <step>
```

Show:

1. A brief summary of what was done (test written, implementation added, refactoring applied).
2. The final test output.
3. The commit that was made.

Then ask: "Step N/M complete. Continue to the next step?" Do not proceed until the user confirms. If the user requests changes, address them and re-verify before moving on.

## Rules

1. **Never skip RED.** Do not write implementation before writing and confirming a failing test.
2. **Never skip GREEN.** Do not move to the next step until the current test passes.
3. **Minimal GREEN only.** The implementation should be the simplest code that passes. Resist the urge to add error handling, abstractions, or features not demanded by the test.
4. **Real refactoring only.** Only refactor when the plan explicitly calls for it. Do not "improve" code that the plan doesn't flag.
5. **Run tests after every phase.** RED → run tests → GREEN → run tests → REFACTOR → run full suite.
6. **Stop on unexpected failure.** If a test fails in an unexpected way (compilation error, wrong test framework, missing dependency), stop and explain the problem. Ask the user how to proceed.
7. **One step at a time.** Complete the full Red-Green-Refactor cycle for one step before starting the next. Never work on two steps simultaneously.
8. **Respect the plan.** If you discover the plan is wrong or incomplete, pause and discuss with the user rather than silently deviating.
9. **Commit after each step using the commit skill.** After completing a full Red-Green-Refactor cycle, invoke `/skill:commit` with a descriptive message following conventional commits format. Example: `/skill:commit feat(auth): add JWT token generation (step 1/N)`.

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
