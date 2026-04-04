---
globs:
  - "pi/.pi/agent/models.json"
description: Pi Mistral model configuration gotchas
---

- Mistral Small 4 (`mistral-small-latest`) must use `reasoning: false` in pi's models.json — `reasoning: true` causes API errors despite the model supporting reasoning_effort natively
