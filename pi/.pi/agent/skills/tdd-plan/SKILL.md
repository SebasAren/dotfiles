---
name: tdd-plan
description: Plan and implement features using TDD (Red-Green-Refactor). Creates a structured plan, then executes it step-by-step. Use when asked to plan, design, or implement a feature with test-first methodology.
---

# TDD Plan & Implement

Plan a feature using strict TDD discipline, then execute the plan step-by-step. Every step follows the Red-Green-Refactor cycle: establish a failing condition (test, type error, compilation error, etc.), make it pass with minimal code, then refactor.

## Process

When this skill is invoked, determine the mode from the user's input:

1. **Plan mode** — User describes a feature to build (no existing plan slug). Jump to [Planning](#planning).
2. **Implement mode** — User provides an existing plan slug, or says "implement" / "continue". Jump to [Implementation](#implementation).
3. **If unclear**, run `tdd-plan list` to show available plans. If plans exist, ask whether to implement one. Otherwise, start planning.

## CLI Reference

```bash
tdd-plan create <slug> --title <title> --steps <text> [--steps-file <path>] [--context <text>] [--architecture <text>] [--notes <json>]
tdd-plan edit <slug> [--title <title>] [--steps <text>] [--steps-file <path>] [--context <text>] [--architecture <text>]
tdd-plan design <slug> [--show] [--current-state <text>] [--desired-state <text>] [--patterns <text>] [--decisions <text>] [--questions <text>]
tdd-plan list                                               # List all plans
tdd-plan show [slug]                                        # Show plan details (defaults to most recent)
tdd-plan phase <slug> <step> <red|green|refactor> <start|done|skip>  # Update phase status
tdd-plan complete <slug> <step>                             # Mark step fully complete
tdd-plan note <slug> <text>                                 # Add a note to the plan
tdd-plan archive <slug>                                     # Archive a completed plan
```

Plans are stored in `.pi/plans/<slug>.json`.

---

## Planning

Create a structured implementation plan. The plan MUST follow strict TDD discipline: every step starts with a failing condition (failing test, type error, compilation error, etc.), then minimal code to pass, then refactor.

### Steps

1. **Understand the request.** Ask clarifying questions if the scope is ambiguous. Don't plan blindly.
2. **Identify test framework.** Note what testing tools are available (look at `package.json`, `pyproject.toml`, Makefile, or ask).
3. **Explore the codebase.** Use the `explore` tool to understand relevant context. Build the explore query from the user's description.
4. **Create a design artifact.** Before drafting steps, create a design artifact that surfaces what the agent found, what it plans to do, and what it doesn't understand. This is the human's opportunity to correct misconceptions *before* code is written. Run:

```bash
tdd-plan create <slug> --title <title> --steps '[{"name":"Placeholder","red":"tbd","green":"tbd","refactor":""}]' --context <context> --architecture <architecture>
tdd-plan design <slug> \
  --current-state "What the codebase looks like now" \
  --desired-state "What the solution should achieve" \
  --patterns "Relevant code patterns found in the codebase" \
  --decisions "Design decisions already resolved" \
  --questions "Things the agent doesn't know and needs answers to"
```

Then present the design artifact to the user for review:

> Review the design artifact. Correct any misconceptions before I plan the steps.
>
> - **Looks good, proceed to planning**
> - **I need to correct something**
> - **Cancel**

If the user selects **needs-changes**, ask what to correct, update the design with `tdd-plan design <slug> --current-state ...` etc., and re-present.

If the user selects **needs-changes**, ask what to correct, update the design with `tdd-plan design <slug> --current-state ...` etc., and re-present. The goal is to give the human every opportunity to correct the agent's understanding *before* planning.

5. **Draft the plan.** With the corrected design artifact in hand, replace the placeholder steps with the real RED/GREEN/REFACTOR steps. Follow the output format below.
6. **Review for completeness.** Check that every piece of functionality has a corresponding test.
7. **Update the plan** using `tdd-plan edit` to replace placeholder steps with real ones. Present the plan inline, then ask for confirmation:

> Does this plan look good?
>
> - **Yes, proceed to implementation**
> - **Let me refine it**
> - **Cancel**

If **refine**, ask what to change and re-draft. If **cancel**, stop. If **yes**, proceed to implementation.

If the user selects **refine**, ask what to change and re-draft. If **cancel**, stop. If **yes**, proceed to implementation.

### Steps format

Steps can be provided as **text format** (recommended for agents) or **JSON**. The CLI auto-detects the format.

**Text format (agent-friendly):**

```
STEP 1: Token generation
RED: Write test that generates a JWT with correct claims (sub, iat, exp) and expiry
GREEN: Implement token generation with jsonwebtoken library
REFACTOR:
---
STEP 2: Auth middleware
RED: Write test that middleware rejects requests without valid JWT
GREEN: Implement auth middleware that validates Bearer tokens
REFACTOR: Extract token validation into reusable helper
```

Rules:
- `STEP N:` starts a new step (N is optional, auto-incremented)
- `RED:` / `GREEN:` / `REFACTOR:` labels the phase description
- `REFACTOR:` can be empty (no refactoring for this step)
- `---` is an optional separator between steps
- Lines starting with `#` are comments

Then create the plan:

```bash
tdd-plan create user-auth \
  --title "User JWT Authentication" \
  --steps "STEP 1: Token generation
RED: Write test that generates a JWT with correct claims (sub, iat, exp) and expiry
GREEN: Implement token generation with jsonwebtoken library
REFACTOR:
---
STEP 2: Auth middleware
RED: Write test that middleware rejects requests without valid JWT
GREEN: Implement auth middleware that validates Bearer tokens
REFACTOR: Extract token validation into reusable helper" \
  --context "Add JWT auth to the REST API. Tokens expire in 1h, refresh tokens in 7d." \
  --architecture "Token-based auth with refresh token rotation"
```

**JSON format (also supported):**

```bash
tdd-plan create user-auth \
  --steps '[{"name":"Step 1: ...","red":"...","green":"..."}]'
```

**Steps file:** If using `--steps-file`, use text format:

```bash
tdd-plan create user-auth --steps-file steps.txt ...
```

### Editing Plans

Use `tdd-plan edit <slug>` to modify an existing plan:

```bash
# Edit title only
tdd-plan edit user-auth --title "New Title"

# Replace all steps using text format
tdd-plan edit user-auth --steps "STEP 1: New step
RED: New test...
GREEN: New implementation...
REFACTOR:"

# Update context
tdd-plan edit user-auth --context "Updated requirements..."
```

### Example

**Recommended approach - text format (agent-friendly):**

```bash
tdd-plan create user-auth \
  --title "User JWT Authentication" \
  --steps "STEP 1: Token generation
RED: Write test that generates a JWT with correct claims (sub, iat, exp) and expiry
GREEN: Implement token generation with jsonwebtoken library
REFACTOR:
---
STEP 2: Auth middleware
RED: Write test that middleware rejects requests without valid JWT
GREEN: Implement auth middleware that validates Bearer tokens
REFACTOR: Extract token validation into reusable helper" \
  --context "Add JWT auth to the REST API. Tokens expire in 1h, refresh tokens in 7d." \
  --architecture "Token-based auth with refresh token rotation" \
  --notes '["Edge case: expired tokens must return 401","Verify concurrent refresh requests"]'
```

**Alternative - JSON:**

```bash
tdd-plan create user-auth \
  --steps '[{"name":"Step 1: Token generation","red":"Write test that generates a JWT with correct claims (sub, iat, exp) and expiry","green":"Implement token generation with jsonwebtoken library","refactor":""},{"name":"Step 2: Auth middleware","red":"Write test that middleware rejects requests without valid JWT","green":"Implement auth middleware that validates Bearer tokens","refactor":"Extract token validation into reusable helper"}]' \
  --context "Add JWT auth to the REST API. Tokens expire in 1h, refresh tokens in 7d." \
  --architecture "Token-based auth with refresh token rotation" \
  --notes '["Edge case: expired tokens must return 401","Verify concurrent refresh requests"]'
```

### Planning Rules

1. **RED first, always.** Never describe implementation without first describing the failing condition that demands it. This can be a failing test, a type error, a compilation error, or another automated validation failure when those are the primary mechanism for the codebase.
2. **Small steps.** Each step should be completable in 5-10 minutes. Break large features into many small steps.
3. **One concept per step.** Don't test two things in one step. Split concerns.
4. **Minimal GREEN.** The "make it pass" section should be the simplest code that works. Save abstractions for refactor.
5. **Real refactoring only.** Don't list refactoring unless there's a concrete reason (duplication, poor naming, wrong abstraction level).
6. **Concrete over vague.** Use actual function names, file paths, input/output examples. Not "add some validation" but "validate that `email` matches `/^[\w.+-]+@[\w-]+\.[\w.]+$/`".
7. **Include edge cases.** If the feature has boundary conditions (empty input, null values, large datasets, concurrent access), add steps for them after the happy path.
8. **Integration tests last.** After unit-level TDD steps, add a final step for integration/acceptance testing.

### Output Format

Present the plan to the user in this format for review:

```
## Plan: [Feature/Change Title]

### Design Artifact
- **Current state:** What the codebase looks like now
- **Desired end state:** What the solution should achieve
- **Patterns:** Relevant code patterns from the codebase
- **Decisions:** Resolved design decisions
- **Open questions:** Things that need answers

### Context
Brief description of what we're building and why.

### Architecture
High-level overview of the components involved.

### Steps
1. **Step Name** — 🔴 [test desc] → 🟢 [impl desc] → 🔵 [refactor desc]
2. ...

### Notes
- Edge cases, integration points, things to watch out for
```

After the user confirms the plan, proceed to [Implementation](#implementation).

---

## Implementation

Execute an existing plan step-by-step. Each step follows the strict Red-Green-Refactor discipline.

### Setup

1. **Locate the plan.** Run `tdd-plan show <slug>` to display the plan. If no slug is provided, run `tdd-plan list` and ask which one to implement.
2. **Confirm the plan.** Show the plan summary, then ask for confirmation:

> Ready to implement this plan?
>
> - **Yes, start implementing**
> - **Show full plan details first**
> - **Not now**

If **view**, run `tdd-plan show <slug>` and ask again. If **cancel**, stop.

If **view**, run `tdd-plan show <slug>` and ask again. If **cancel**, stop.
3. **Determine test command.** Check how to run tests in the project:
   - **Node.js:** `package.json` `"test"` script. Common: `npm test`, `npx vitest`, `npx jest`.
   - **Python:** `pyproject.toml` or `setup.cfg`. Common: `pytest`, `python -m pytest`.
   - **Go:** `go test ./...`
   - **Rust:** `cargo test`
   - **Ruby:** `bundle exec rspec`
   - **Other:** Look at Makefile, justfile, or ask the user.
4. If you cannot determine the test command, ask before proceeding.
5. **Explore the codebase.** Before writing any code, use the `explore` tool to understand the relevant codebase context. Build the explore query from the plan's context and architecture fields. For example: `explore({ query: "Find existing auth middleware, JWT handling, and user model in this project" })`. This exploration is implementation-focused (finding exact files, functions, imports to modify) and is separate from the design-phase exploration done during Planning. This establishes a shared understanding and becomes the session tree kickoff point.
6. **Set the kickoff point.** After exploration completes, call the `tdd-set-kickoff` tool with the plan slug: `tdd-set-kickoff({ slug: "<slug>" })`. This labels the current session tree position as the TDD kickoff checkpoint. **IMPORTANT: This must be called exactly once per plan, only after the initial exploration. Never call `tdd-set-kickoff` again for the same plan.** Each subsequent step can optionally branch fresh from this single kickoff point.

### Fresh Start (per step, optional)

Before starting a step, the user may choose to branch fresh from the kickoff point. This gives each step a clean session context — only the initial exploration is shared.

If the user wants to start fresh, they can say so naturally (e.g., "fresh branch from kickoff") and you will send `/tdd-go-kickoff <slug>` as a user message. This navigates the session tree to the **existing** kickoff checkpoint (set in step 6) and creates a new branch. The abandoned branch is summarized automatically. **Never call `tdd-set-kickoff` again — use `/tdd-go-kickoff` to return to the single kickoff point.**

Starting fresh is especially useful when:
- A previous step's implementation is cluttering context
- You want to approach the step with a clean mental model
- The step is independent of previous step changes

### Red-Green-Refactor Cycle

For each step in the plan, execute these three phases **in strict order**:

#### 🔴 RED — Establish the failing condition

- **Update progress:** `tdd-plan phase <slug> <step> red start`
- Read the step's RED description from `tdd-plan show <slug>`.
- Write the test file, add the test case, or introduce the change that triggers a type/compilation error.
- Run the validation command (test suite, typecheck, compilation, etc.) to **confirm it fails** with the expected error.
- If the validation passes or fails with an unexpected error, stop and report the issue. Do not proceed to GREEN.
- **Update progress:** `tdd-plan phase <slug> <step> red done`
- Output the failing validation output for the user to see.

#### 🟢 GREEN — Make it pass

- **Update progress:** `tdd-plan phase <slug> <step> green start`
- Read the step's GREEN description from `tdd-plan show <slug>`.
- Write the **simplest code** that makes the test pass. No gold-plating, no speculative abstractions.
- Run the validation command (test suite, typecheck, compilation, etc.) to **confirm it passes**.
- If the validation still fails, iterate on the implementation — but stay minimal. Do not add extra features.
- **Update progress:** `tdd-plan phase <slug> <step> green done`
- Output the passing result for the user to see.
- **Commit via `/skill:commit`** to checkpoint the minimal implementation and trigger commit hooks (lint, typecheck, etc.) before any refactoring.

#### 🔵 REFACTOR — Clean up (if applicable)

- Read the step's REFACTOR description from `tdd-plan show <slug>`. Skip this phase entirely if the description is empty.
- **Update progress:** `tdd-plan phase <slug> <step> refactor start` (or `skip` if no refactoring needed)
- Apply the described refactoring while keeping all validations green.
- Run the **full** validation command (not just the current test) to confirm nothing broke.
- If any validation fails, revert the refactoring and try again.
- **Update progress:** `tdd-plan phase <slug> <step> refactor done` (or `skip` was already called)
- Output the full validation result.
- If refactoring produced significant changes, **commit again via `/skill:commit`** to preserve the refactored state.

### User Verification

After committing after GREEN (to trigger hooks on the minimal implementation) and completing the full Red-Green-Refactor cycle, **mark the step complete**:

```bash
tdd-plan complete <slug> <step>
```

Show:

1. A brief summary of what was done (validation established, implementation added, refactoring applied, commits made).
2. The final validation output.
3. The commit(s) that were made (after GREEN and/or after REFACTOR).


**Then stop and ask the user what to do next.** The user will naturally say things like:
- "Continue to next step" → proceed to the next step
- "Fresh branch from kickoff" → send `/tdd-go-kickoff <slug>`, then proceed
- "I want to make some changes" → address feedback, then ask again
- "Pause here" → stop and let the user resume later

### Finish

After all steps are complete, show the final summary and ask what to do:

> All steps complete! What would you like to do?
>
> - **Archive the plan** — Move to `.pi/plans/archive/`
> - **Keep the plan** — Leave it for reference

If **archive**, run `tdd-plan archive <slug>`.

If **archive**, run `tdd-plan archive <slug>`.

---

## Rules

1. **Never skip RED.** Do not write implementation before writing and confirming a failing validation (test, type error, compilation error, etc.).
2. **Never skip GREEN.** Do not move to the next step until the current validation passes.
3. **Minimal GREEN only.** The implementation should be the simplest code that passes. Resist the urge to add error handling, abstractions, or features not demanded by the test.
4. **Real refactoring only.** Only refactor when the plan explicitly calls for it. Do not "improve" code that the plan doesn't flag.
5. **Run validation after every phase.** RED → run validation → GREEN → run validation → commit → REFACTOR → run full validation.
6. **Stop on unexpected failure.** If a validation fails in an unexpected way (compilation error, wrong test framework, missing dependency), stop and explain. Ask the user how to proceed.
7. **One step at a time.** Complete the full Red-Green-Refactor cycle for one step before starting the next. Never work on two steps simultaneously.
8. **Respect the plan.** If you discover the plan is wrong or incomplete, pause and discuss with the user rather than silently deviating.
9. **Commit after GREEN and after the full step.** Commit via `/skill:commit` after GREEN to trigger hooks on the minimal implementation, then again after completing the full Red-Green-Refactor cycle (if REFACTOR produced meaningful changes).
10. **Single kickoff point only.** Call `tdd-set-kickoff` exactly once per plan, immediately after the exploration phase. Never call it again. Use `/tdd-go-kickoff <slug>` to navigate back to this single kickoff point for fresh steps, but never create new checkpoints.

## Error Handling

- **Validation framework not found:** Stop and ask the user to install or configure the test framework, type checker, compiler, or other validation tool.
- **Unexpected validation pass in RED:** The validation may not be asserting the right thing, or the feature may already exist. Report and ask.
- **Cannot make GREEN pass after 3 attempts:** Stop and explain. Suggest simplifying the validation or splitting the step.
- **Refactoring breaks validation:** Revert immediately. Report and ask whether to skip the refactoring or take a different approach.

## Usage

```
/skill:tdd-plan <feature description>        # Plan a new feature, then implement
/skill:tdd-plan <plan-slug>                  # Implement an existing plan
/skill:tdd-plan                              # List plans or start planning
```
