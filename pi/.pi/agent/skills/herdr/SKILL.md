---
name: herdr
description: "Control herdr from inside it. Manage workspaces and tabs, split panes, spawn agents, read output, and wait for state changes — all via CLI commands that talk to the running herdr instance over a local unix socket. Use when running inside herdr (HERDR_ENV=1)."
---

# herdr — agent skill

you are running inside herdr, a terminal-native agent multiplexer. herdr gives you workspaces, tabs, and panes — each pane is a real terminal with its own shell, agent, server, or log stream — and you can control all of it from the cli.

this means you can:

- see what other panes and agents are doing
- create tabs for separate subcontexts inside one workspace
- split panes and run commands in them
- start servers, watch logs, and run tests in sibling panes
- wait for specific output before continuing
- wait for another agent to finish
- spawn more agent instances

the `herdr` binary is available in your PATH. its workspace, tab, pane, and wait commands talk to the running herdr instance over a local unix socket.

if you need the raw protocol or full api reference, read [`SOCKET_API.md`](./SOCKET_API.md).

## concepts

**workspaces** are project contexts. each workspace has one or more tabs. unless manually renamed, a workspace's label follows the first tab's root pane — usually the repo name, otherwise the root pane's current folder name.

**tabs** are subcontexts inside a workspace. each tab has one or more panes.

**panes** are terminal splits inside a tab. each pane runs its own process — a shell, an agent, a server, anything.

**agent status** is detected automatically by herdr. the api exposes one public field for it:

- `agent_status` — `idle`, `working`, `blocked`, `done`, `unknown`

| Status | Meaning | Typical Scenario |
|--------|---------|------------------|
| `idle` | Agent is running and waiting at its prompt for input | `pi` or `claude` after completing a task, ready for the next command |
| `working` | Agent is actively processing (streaming tokens, running tools) | Any agent mid-response |
| `blocked` | Agent is waiting on external input (user prompt, tool result) | Agent paused mid-conversation |
| `done` | Agent session **terminated** and output has not been reviewed yet | A batch script that invoked `claude` with one task and exited; the pane content is unread |
| `unknown` | herdr cannot determine the agent's state | Edge cases, startup |

**Critical distinction:** `idle` means the agent is still alive and waiting. `done` means the agent's process has **exited** and the output is unread. For interactive agents like `pi` that stay running after each task, use `--status idle`. For batch agents that run once and terminate, use `--status done`.

plain shells still exist as panes, but herdr's sidebar agent section intentionally focuses on detected agents rather than listing every shell.

**ids** — workspace ids look like `1`, `2`. tab ids look like `1:1`, `1:2`, `2:1`. pane ids look like `1-1`, `1-2`, `2-1`. these are compact public ids for the current live session.

important: ids can compact when tabs, panes, or workspaces are closed. do not treat them as durable ids. re-read ids from `workspace list`, `tab list`, `pane list`, or create/split responses when you need a current id. do not guess that an older `1-3` is still the same pane later.

## discover yourself

see what panes exist and which one is focused:

```bash
herdr pane list
```

the focused pane is yours. other panes are your neighbors.

list workspaces:

```bash
herdr workspace list
```

## tab management

list tabs in the current workspace:

```bash
herdr tab list --workspace 1
```

create a new tab:

```bash
herdr tab create --workspace 1
```

without `--label`, the new tab keeps the default numbered tab name.

create and name it in one step:

```bash
herdr tab create --workspace 1 --label "logs"
```

rename it:

```bash
herdr tab rename 1:2 "logs"
```

focus it:

```bash
herdr tab focus 1:2
```

close it:

```bash
herdr tab close 1:2
```

## read another pane

see what is on another pane's screen:

```bash
herdr pane read 1-1 --source recent --lines 50
```

- `--source visible` = current viewport
- `--source recent` = recent scrollback as rendered in the pane
- `--source recent-unwrapped` = recent terminal text with soft wraps joined back together

## split a pane and run a command

split your pane to the right and keep focus on your current pane:

```bash
herdr pane split 1-2 --direction right --no-focus
```

that prints json with the new pane nested at `result.pane.pane_id`. parse that value, then run a command in that pane:

```bash
NEW_PANE=$(herdr pane split 1-2 --direction right --no-focus | python3 -c 'import sys,json; print(json.load(sys.stdin)["result"]["pane"]["pane_id"])')
herdr pane run "$NEW_PANE" "npm run dev"
```

split downward instead:

```bash
herdr pane split 1-2 --direction down --no-focus
```

## wait for output

block until specific text appears in a pane. useful for waiting on servers, builds, and tests.

for `--source recent`, matching uses unwrapped recent terminal text, so pane width and soft wrapping do not break matches. `pane read --source recent` still shows the pane as rendered. if you want to inspect the same transcript that the waiter matches, use `pane read --source recent-unwrapped`.

```bash
herdr wait output 1-3 --match "ready on port 3000" --timeout 30000
```

with regex:

```bash
herdr wait output 1-3 --match "server.*ready" --regex --timeout 30000
```

if it times out, exit code is `1`.

## wait for an agent status

block until another agent *transitions into* a specific status:

```bash
# wait for a batch agent (script invoking claude) to finish and exit
herdr wait agent-status 1-1 --status done --timeout 60000

# wait for an interactive agent (pi) to finish a task and return to prompt
herdr wait agent-status 1-1 --status idle --timeout 60000
```

**Important:** `wait agent-status` watches for a **transition** into the target status. It does **not** check the current state. If the agent is already in the target status when you start waiting, the wait will hang until it transitions *again* or times out.

**Which status to use:**

| If the agent is… | Wait for… | Reason |
|---|---|---|
| A batch script that runs `claude` and exits | `done` | The process terminates; `done` means finished + unread output |
| An interactive agent like `pi` that stays running after each task | `idle` | The process stays alive; `idle` means back at the prompt, ready for input |
| A long-running server or watcher | `idle` or `output` | It never termininates — use `idle` for readiness or `wait output` for a specific log line |

**Gotchas:**

1. **Wrong status for interactive agents:** `--status done` on `pi` will time out — `pi` never exits, it transitions `working` → `idle` after each task, never reaching `done`.

2. **`idle` is now terminal for interactive agents:** `pi` previously went `idle` on *every* subtask boundary because extensions (like `herdr-agent-state.ts`) leaked into subagent sessions and reported false state transitions. This root cause is now fixed — subagent sessions no longer send state changes to herdr. `wait agent-status --status idle` now fires only when the main agent truly finishes its full response.

3. **Race on already-idle agent:** If the agent is already `idle` when you call `wait agent-status --status idle`, the wait will hang because it only fires on a *transition*.

   **Practical pattern for interactive agents (post-fix):** With the subtask false-idle bug fixed, a single `wait agent-status --status idle` followed by `pane read` is now sufficient:

   ```bash
   herdr wait agent-status 1-1 --status idle --timeout 300000
   herdr pane read 1-1 --source recent --lines 100
   ```

   If the agent was already idle when you started waiting (race condition — `wait agent-status` is transition-based, not snapshot-based), check `pane list` first to confirm the current state, or set a short initial timeout as a guard.

## send text or keys to a pane

send text without pressing Enter:

```bash
herdr pane send-text 1-1 "hello from claude"
```

press Enter or other keys:

```bash
herdr pane send-keys 1-1 Enter
```

`pane run` sends the text and then a real `Enter` key in one request:

```bash
herdr pane run 1-1 "echo hello"
```

## workspace management

create a new workspace:

```bash
herdr workspace create --cwd /path/to/project
```

without `--label`, the new workspace keeps the default cwd-based name.

create and name one in one step:

```bash
herdr workspace create --cwd /path/to/project --label "api server"
```

create one without focusing it:

```bash
herdr workspace create --no-focus
```

focus a workspace:

```bash
herdr workspace focus 2
```

rename:

```bash
herdr workspace rename 1 "api server"
```

close:

```bash
herdr workspace close 2
```

## close a pane

```bash
herdr pane close 1-3
```

## recipes

### run a server and wait until it is ready

```bash
NEW_PANE=$(herdr pane split 1-2 --direction right --no-focus | python3 -c 'import sys,json; print(json.load(sys.stdin)["result"]["pane"]["pane_id"])')
herdr pane run "$NEW_PANE" "npm run dev"
herdr wait output "$NEW_PANE" --match "ready" --timeout 30000
herdr pane read "$NEW_PANE" --source recent --lines 20
```

### run tests in a separate pane and inspect the result

```bash
herdr pane split 1-2 --direction down --no-focus
herdr pane run 1-3 "cargo test"
herdr wait output 1-3 --match "test result" --timeout 60000
herdr pane read 1-3 --source recent --lines 30
```

### check what another agent is working on

```bash
herdr pane list
herdr pane read 1-1 --source recent --lines 80
```

### watch another pane robustly

use this pattern when you need to coordinate with a sibling pane:

```bash
# inspect what is already there
herdr pane read 1-3 --source recent --lines 40

# wait only for the next output you expect
herdr wait output 1-3 --match "ready" --timeout 30000

# if you need to inspect the same transcript the waiter matched,
# read the unwrapped recent text directly
herdr pane read 1-3 --source recent-unwrapped --lines 40
```

### spawn an interactive agent (pi) and give it a task

```bash
herdr pane split 1-2 --direction right --no-focus
NEW_PANE=$(python3 -c 'import json,sys; print(json.load(sys.stdin)["result"]["pane"]["pane_id"])' < <(cat))
herdr pane run "$NEW_PANE" "pi"
herdr wait output "$NEW_PANE" --match "pi v" --timeout 30000
herdr pane run "$NEW_PANE" "explore the test setup in src/"
# Wait for pi to finish the full response (subtask false-idle bug is fixed)
herdr wait agent-status "$NEW_PANE" --status idle --timeout 300000
herdr pane read "$NEW_PANE" --source recent --lines 100
```

### spawn a batch agent (claude) and give it a task

```bash
herdr pane split 1-2 --direction right --no-focus
herdr pane run 1-3 "claude"
herdr wait output 1-3 --match ">" --timeout 15000
herdr pane run 1-3 "review the test coverage in src/api/"
herdr wait agent-status 1-3 --status done --timeout 300000
herdr pane read 1-3 --source recent --lines 100
```

### coordinate with another agent (interactive, e.g. pi)

With the subtask false-idle bug fixed, `wait agent-status --status idle` now fires only when pi's main agent truly finishes its full response. The simple pattern is reliable:

```bash
herdr wait agent-status 1-1 --status idle --timeout 120000
herdr pane read 1-1 --source recent --lines 100
```

If the agent was already idle when the wait started (race condition — `wait agent-status` is transition-based, not snapshot-based), check `pane list` first to confirm the current state, or use a short initial timeout as a guard.

### coordinate with another agent (batch, e.g. claude script)

```bash
herdr wait agent-status 1-1 --status done --timeout 120000
herdr pane read 1-1 --source recent --lines 100
```

## notes

- `workspace list`, `workspace create`, `tab list`, `tab create`, `tab get`, `tab focus`, `tab rename`, `tab close`, `pane list`, `pane get`, `pane split`, `wait output`, and `wait agent-status` print json on success.
- `pane read` prints text, not json.
- `pane read --format ansi` or `pane read --ansi` returns a rendered ANSI snapshot for TUI feedback loops.
- `pane read --source recent-unwrapped` is useful when you want to inspect the same unwrapped transcript that `wait output --source recent` matches against.
- `pane send-text`, `pane send-keys`, and `pane run` print nothing on success.
- parse ids from `workspace create`, `tab create`, and `pane split` responses when you need new ids. `workspace create` returns `result.workspace`, `result.tab`, and `result.root_pane`. `tab create` returns `result.tab` and `result.root_pane`. for `pane split`, the new pane id is at `result.pane.pane_id`.
- use `pane read` for current output that already exists. use `wait output` for future output you expect next.
- `wait output` works on **any** pane (servers, agents, shells). `wait agent-status` only works on panes detected as agents.
- `wait agent-status` watches for a **status transition**, not the current state. If the agent is already in the target state, the wait will hang — check first with `pane list` or use the loop pattern below.
- `wait agent-status --status idle` on interactive agents like `pi` now fires **only when the main agent finishes its full response** (subtask false-idle bug fixed). This is the reliable signal for completion — no loop needed.
- `wait agent-status --status done` is only correct for batch agents (scripts that invoke `claude`, run a test suite, and terminate).
- pi has **no structured end-of-response marker**, but `wait agent-status --status idle` now reliably fires only at full response completion (false-idle bug fixed). A single wait + read is sufficient.
- pi's startup banner does not use `❯`, `>`, `▌`, or any single-character prompt — it prints a multi-line banner ending with a status bar. To wait for pi to be ready, match on `"pi v"` (lowercase, appears early) or `"[Skills]"` (appears after all rules and context are loaded).
- `--no-focus` on split, tab create, and workspace create keeps your current terminal context focused.
- without `--label`, workspace create keeps cwd-based naming and tab create keeps numbered naming.
- `--label` on tab create and workspace create applies the custom name immediately.
- if you are running inside herdr, the `HERDR_ENV` environment variable is set to `1`.
