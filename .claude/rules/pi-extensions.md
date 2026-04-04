---
description: Pi extension development conventions and gotchas
---

- **Bun virtual path handling**: Bun virtualizes `process.cwd()` into `/bunfs/...` which doesn't exist for subprocesses. When spawning subprocesses that need to work with the filesystem, pass the resolved real cwd via environment variable (e.g., `PI_REAL_CWD`) and check for it first in `resolveRealCwd()` functions.
- **Subagent cwd propagation**: Explore and other subagent extensions must propagate the real working directory to spawned processes, otherwise nested pi processes receive virtual paths that don't exist on the real filesystem.
