---
name: tdd-plan
description: Creates a detailed implementation plan following TDD (Red-Green-Refactor). Use when asked to plan an implementation, design a feature, or break down work into steps. Always produces a structured plan with test-first methodology.
---

# TDD Implementation Plan

Create a structured implementation plan for the requested feature or change. The plan MUST follow strict TDD discipline: every step starts with a failing test, then minimal code to pass, then refactor.

## Process

When this skill is invoked:

1. **Understand the request.** Ask clarifying questions if the scope is ambiguous. Don't plan blindly.
2. **Identify test framework.** Note what testing tools are available (look at `package.json`, `pyproject.toml`, Makefile, or ask).
3. **Draft the plan.** Follow the output format below with all RED/GREEN/REFACTOR steps.
4. **Review for completeness.** Check that every piece of functionality has a corresponding test.
5. **Create the plan** using the `tdd-plan` CLI tool. Present the plan inline and ask the user to confirm before proceeding with implementation.

## Creating a Plan

Use the `tdd-plan` CLI tool to create and manage plans. Plans are stored in `.pi/plans/<slug>.json`.

### Create

```bash
tdd-plan create <slug> \
  --title "Feature Title" \
  --context "Why we're building this, key constraints" \
  --architecture "High-level overview" \
  --steps '<json-array>' \
  --notes '<json-array>'
```

**Steps JSON format:**
```json
[
  {
    "name": "Step 1: <descriptive name>",
    "red": "Describe the failing test: what it tests, expected behavior, why it should fail. Include function signatures, expected inputs/outputs.",
    "green": "Describe the minimal implementation. No gold-plating.",
    "refactor": "Note refactoring opportunities. Use empty string if not needed."
  }
]
```

**Example:**
```bash
tdd-plan create user-auth \
  --title "User JWT Authentication" \
  --context "Add JWT auth to the REST API. Tokens expire in 1h, refresh tokens in 7d." \
  --architecture "Token-based auth with refresh token rotation" \
  --steps '[{"name":"Step 1: Token generation","red":"Write test that generates a JWT with correct claims (sub, iat, exp) and expiry","green":"Implement token generation with jsonwebtoken library","refactor":""},{"name":"Step 2: Auth middleware","red":"Write test that middleware rejects requests without valid JWT","green":"Implement auth middleware that validates Bearer tokens","refactor":"Extract token validation into reusable helper"}]' \
  --notes '["Edge case: expired tokens must return 401","Verify concurrent refresh requests"]'
```

### Other commands

```bash
tdd-plan list                    # List all plans
tdd-plan show [slug]             # Show plan details (defaults to most recent)
tdd-plan note <slug> <text>      # Add a note to the plan
```

## Planning Rules

1. **Tests first, always.** Never describe implementation without first describing the failing test that demands it.
2. **Small steps.** Each step should be completable in 5-10 minutes. Break large features into many small steps.
3. **One concept per step.** Don't test two things in one step. Split concerns.
4. **Minimal GREEN.** The "make it pass" section should be the simplest code that works. Save abstractions for refactor.
5. **Real refactoring only.** Don't list refactoring unless there's a concrete reason (duplication, poor naming, wrong abstraction level).
6. **Concrete over vague.** Use actual function names, file paths, input/output examples. Not "add some validation" but "validate that `email` matches `/^[\w.+-]+@[\w-]+\.[\w.]+$/`".
7. **Include edge cases.** If the feature has boundary conditions (empty input, null values, large datasets, concurrent access), add steps for them after the happy path.
8. **Integration tests last.** After unit-level TDD steps, add a final step for integration/acceptance testing.

## Output Format

Present the plan to the user in this format for review:

```
## Plan: [Feature/Change Title]

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

## Usage

```
/skill:tdd-plan <feature description>
/skill:tdd-plan add user authentication with JWT
/skill:tdd-plan implement the shopping cart module
```
