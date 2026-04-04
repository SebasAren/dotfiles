---
name: tdd-plan
description: Creates a detailed implementation plan following TDD (Red-Green-Refactor). Use when asked to plan an implementation, design a feature, or break down work into steps. Always produces a structured plan with test-first methodology.
---

# TDD Implementation Plan

Create a structured implementation plan for the requested feature or change. The plan MUST follow strict TDD discipline: every step starts with a failing test, then minimal code to pass, then refactor.

## Output Format

Write the plan as a markdown file (or inline) with these sections:

---

## Plan: [Feature/Change Title]

### Context
Brief description of what we're building and why. Key constraints or decisions.

### Architecture
High-level overview of the components involved and how they interact. Keep it brief — focus on the shape of the solution.

### Step 1: [Step Name]

**🔴 RED — Write a failing test**
```
Describe the test: what it tests, expected behavior, and why it should fail.
Include enough detail to write the test (function signatures, expected inputs/outputs).
```

**🟢 GREEN — Make it pass**
```
Describe the minimal implementation to make the test pass. No gold-plating.
```

**🔵 REFACTOR — Clean up (if needed)**
```
Note any refactoring opportunities. Skip if the code is already clean.
```

### Step 2: [Step Name]
...repeat the RED/GREEN/REFACTOR pattern for each step...

### Summary

| Step | Test | Implementation |
|------|------|---------------|
| 1 | ... | ... |
| 2 | ... | ... |
| N | ... | ... |

### Progress Log

> This section is maintained by the tdd-implement skill. Do not edit manually.

**Status:** Not started

| Step | 🔴 RED | 🟢 GREEN | 🔵 REFACTOR |
|------|--------|----------|-------------|
| 1 | ⬜ | ⬜ | ⬜ |
| 2 | ⬜ | ⬜ | ⬜ |
| N | ⬜ | ⬜ | ⬜ |

### Notes
- Edge cases discovered during planning
- Integration points to verify
- Things to watch out for

---

## Planning Rules

1. **Tests first, always.** Never describe implementation without first describing the failing test that demands it.
2. **Small steps.** Each step should be completable in 5-10 minutes. Break large features into many small steps.
3. **One concept per step.** Don't test two things in one step. Split concerns.
4. **Minimal GREEN.** The "make it pass" section should be the simplest code that works. Save abstractions for refactor.
5. **Real refactoring only.** Don't list refactoring unless there's a concrete reason (duplication, poor naming, wrong abstraction level).
6. **Concrete over vague.** Use actual function names, file paths, input/output examples. Not "add some validation" but "validate that `email` matches `/^[\w.+-]+@[\w-]+\.[\w.]+$/`".
7. **Include edge cases.** If the feature has boundary conditions (empty input, null values, large datasets, concurrent access), add steps for them after the happy path.
8. **Integration tests last.** After unit-level TDD steps, add a final step for integration/acceptance testing.

## Process

When this skill is invoked:

1. **Understand the request.** Ask clarifying questions if the scope is ambiguous. Don't plan blindly.
2. **Identify test framework.** Note what testing tools are available (look at `package.json`, `pyproject.toml`, Makefile, or ask).
3. **Draft the plan.** Follow the output format above with all RED/GREEN/REFACTOR steps.
4. **Review for completeness.** Check that every piece of functionality has a corresponding test.
5. **Write the plan.** Always write the plan to `.pi/plans/<slug>.md` where `<slug>` is a short kebab-case description derived from the feature name (e.g., `user-jwt-auth.md`). Create the `.pi/plans/` directory if it doesn't exist. The plan MUST include the Progress Log section from the template above — fill in one row per step with all phases set to ⬜. After writing, present the plan inline and ask the user to confirm before proceeding with implementation.

## Usage

```
/skill:tdd-plan <feature description>
/skill:tdd-plan add user authentication with JWT
/skill:tdd-plan implement the shopping cart module
```
