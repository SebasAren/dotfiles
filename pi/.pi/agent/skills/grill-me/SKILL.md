---
name: grill-me
description: >
  Adversarial design interview — probe the user's plan with relentless questions until both parties
  share a clear mental model of what's being built. Use when the user says "grill me", asks you to
  interview them about a plan, wants to stress-test an idea before implementation, or says they want
  to clarify a feature before coding. Also use before large implementation tasks where the spec is
  unclear or ambiguous.
---

# Grill Me

Interview the user relentlessly about their plan until both parties reach a shared understanding of what's being built. Based on Frederick Brooks' "design concept" — the ephemeral shared idea that floats between collaborators. The AI acts as adversary, not yes-man.

## When to Activate

- User says "grill me", "interview me", "stress-test this idea"
- User describes a feature/plan that is vague, underspecified, or has obvious gaps
- Before starting a large implementation task where the spec is unclear
- User asks "what questions should I answer before we start?"
- Before TDD planning or design-artifact creation

**Do NOT activate when** the user gives a precise, well-scoped task with clear acceptance criteria. Grill-me is for *alignment*, not for delaying obvious work.

**Primary domains:** coding tasks and wiki maintenance. Other domains work too, but these are the expected ones.

## The Interview Process

### Phase 1: Classify the task

Ask **one** clarifying question to determine scope:

> "Before we start, I want to make sure I understand what you're building. Can you describe the end state you have in mind — what does 'done' look like?"

Based on the answer, classify the task:

| Classification | Meaning | Next step |
|----------------|---------|-----------|
| **Trivial** | The user has a clear, simple goal | Skip grill-me, just do it |
| **Moderate** | Some ambiguity but direction is clear | Ask 5–10 targeted questions |
| **Complex** | Multiple decisions, dependencies, or unknowns | Full grill-me interview (20+ questions) |

If trivial, say so and proceed. If moderate or complex, continue to Phase 2.

### Phase 2: Walk the design tree

Systematically explore the plan by branching through decision nodes. For each area, ask probing questions that expose unknowns:

**Scope questions:**
- What's in scope? What's explicitly out of scope?
- What's the minimum viable version? What would be nice-to-have?
- Who are the users? What are their skill levels?

**Edge cases:**
- What happens when [thing] fails or returns unexpected data?
- Are there error states, timeouts, or fallback behaviors to handle?
- What about concurrent access, race conditions, or conflicting state?

**Dependencies:**
- What existing code/patterns must this work with?
- Are there APIs, configs, or services this depends on?
- What needs to happen first before this can work?

**Trade-offs:**
- Speed vs. correctness — how important is perfect behavior vs. good enough?
- Simplicity vs. flexibility — should this handle future cases or just the current one?
- Consistency vs. pragmatism — does this need to match existing patterns exactly?

**Non-obvious constraints:**
- Are there performance requirements (latency, throughput, memory)?
- Are there security or access-control considerations?
- Does this need to work offline, on slow connections, or with partial data?

### Phase 3: Play adversary

For each answer, push back:

- **"Why that approach and not [alternative]?"** — Challenge the user's first instinct
- **"What would break if we did it the simpler way?"** — Test whether complexity is justified
- **"Have you considered [edge case]?"** — Surface gaps neither party saw
- **"How would you explain this to someone unfamiliar with the codebase?"** — Test clarity of the design concept

If the user says "I don't know" or "I haven't thought about that" — that's a successful grill. Mark it as an **open question** and move on. Don't force answers; open questions are valuable output.

### Phase 4: Alignment summary + routing

Once you've covered the design tree (or the user says they've had enough), produce an **alignment summary** — a shared understanding of what we're building, not a design artifact. The planning tool (tdd-plan or plan mode) handles the detailed *how*; grill-me establishes the *what* and *why*.

```markdown
## Alignment: [Feature/Plan Name]

### What we're building
[1–2 sentences describing the agreed end state]

### Key decisions resolved
- [Decision]: [Resolution] — [rationale]

### Open questions
- [ ] [Question that still needs an answer]

### Recommended next step
[Routed to `/skill:tdd-plan`, `/plan`, or "just do it" — see routing logic below]
```

Then route to the appropriate next step:

| Routing | When | Next step |
|---------|------|----------|
| **TDD plan** | Task is well-scoped with clear pass/fail conditions, benefits from incremental steps with tests | `/skill:tdd-plan <description>` |
| **Plan mode** | Task is exploratory, config-oriented, or doesn't have a natural test loop | `/plan` then explore in read-only mode |
| **Just do it** | Alignment was the only blocker — the task is simple and understood | Proceed directly |

A task that seemed like "just explore this" may have been **promoted** to TDD territory by the grilling process — the interview sharpened the spec enough that structured planning now makes sense. Say so explicitly: "Based on what we've aligned on, this is a good candidate for TDD."

Ask the user to confirm the routing. If they disagree, adjust.

## Guidelines

- **Be relentless but not pedantic.** Ask meaningful questions that affect the design, not bikeshedding on naming.
- **One question at a time.** Don't overwhelm with a wall of questions. Let the user answer, then follow up.
- **Track resolved decisions.** Don't re-ask things the user already answered clearly.
- **Respect "I don't know."** Open questions are fine output. Better to surface them now than discover them mid-implementation.
- **Don't be a yes-man.** If the user's plan has flaws, say so. The whole point is adversarial alignment.
- **Stop when aligned.** If it becomes clear the user has a solid plan after a few questions, produce the summary and route. Don't grill for grilling's sake.
- **Grill-me produces alignment, not artifacts.** The output is a shared understanding and a routing decision. Design artifacts (current state, desired state, patterns) are produced by the planning tool — tdd-plan or plan mode — not by grill-me.

## Usage

```
/skill:grill-me                          # Grill me about whatever I just described
/skill:grill-me <topic>                  # Grill me about a specific topic
/grill me about the auth refactor        # Natural language trigger
```