import {
  Container,
  Text,
  Spacer,
  TUI,
  ProcessTerminal,
  Input,
  type SelectItem,
  SelectList,
  type OverlayHandle,
} from "@mariozechner/pi-tui";
import { spawnSync } from "child_process";
import {
  existsSync,
  readdirSync,
  readFileSync,
  unlinkSync,
  writeFileSync,
} from "fs";
import { homedir } from "os";
import { join } from "path";

// ── ANSI helpers ──────────────────────────────────────────────────
const bold = (s: string) => `\x1b[1m${s}\x1b[0m`;
const dim = (s: string) => `\x1b[2m${s}\x1b[0m`;
const green = (s: string) => `\x1b[32m${s}\x1b[0m`;
const red = (s: string) => `\x1b[31m${s}\x1b[0m`;
const yellow = (s: string) => `\x1b[33m${s}\x1b[0m`;

// ── State dir ─────────────────────────────────────────────────────
const STATE_DIR = join(
  process.env.XDG_CACHE_HOME || join(homedir(), ".cache"),
  "wpi",
);

// ── Repo ID ───────────────────────────────────────────────────────
function getRepoId(): string {
  const result = spawnSync("git", ["rev-parse", "--show-toplevel"], {
    encoding: "utf-8",
    stdio: "pipe",
  });
  const root = result.stdout.trim() || process.cwd();
  // Simple hash (MD5 not available in Bun crypto without import, use a basic hash)
  let hash = 0;
  for (let i = 0; i < root.length; i++) {
    const ch = root.charCodeAt(i);
    hash = ((hash << 5) - hash + ch) | 0;
  }
  return Math.abs(hash).toString(16).slice(0, 8).padStart(8, "0");
}

// ── State helpers ─────────────────────────────────────────────────
interface WpiState {
  branch: string;
  sourceBranch: string;
  stage: string;
  repoId: string;
}

function loadStates(): WpiState[] {
  if (!existsSync(STATE_DIR)) return [];
  const repoId = getRepoId();
  const states: WpiState[] = [];
  for (const f of readdirSync(STATE_DIR)) {
    if (!f.endsWith(".state")) continue;
    const content = readFileSync(join(STATE_DIR, f), "utf-8");
    const repoIdMatch = content.match(/^repo_id=(.+)$/m);
    if (repoIdMatch?.[1] !== repoId) continue;
    const branch = content.match(/^branch=(.+)$/m)?.[1] ?? "";
    const sourceBranch = content.match(/^source_branch=(.+)$/m)?.[1] ?? "";
    const stage = content.match(/^stage=(.+)$/m)?.[1] ?? "";
    states.push({ branch, sourceBranch, stage, repoId });
  }
  return states;
}

function getCurrentBranch(): string {
  const result = spawnSync("git", ["branch", "--show-current"], {
    encoding: "utf-8",
    stdio: "pipe",
  });
  return result.stdout.trim() || "???";
}

// ── Run command helper ────────────────────────────────────────────
// Stops TUI, runs command with inherited stdio, restarts TUI
function runInteractive(
  tui: TUI,
  handle: OverlayHandle,
  command: string,
  args: string[],
  env?: Record<string, string>,
): { exitCode: number; stdout: string; stderr: string } {
  // Hide overlay and stop TUI so the subprocess gets the terminal
  handle.setHidden(true);
  tui.stop();

  // Write a newline to clean up after TUI
  process.stdout.write("\r\n");

  const result = spawnSync(command, args, {
    encoding: "utf-8",
    stdio: "inherit",
    env: { ...process.env, ...env },
  });

  // Restart TUI and show overlay
  tui.start();
  handle.setHidden(false);
  tui.requestRender(true);

  return {
    exitCode: result.status ?? 1,
    stdout: "",
    stderr: "",
  };
}

// Runs a command capturing output (no terminal takeover needed)
function runCapture(
  command: string,
  args: string[],
  env?: Record<string, string>,
): { exitCode: number; stdout: string; stderr: string } {
  const result = spawnSync(command, args, {
    encoding: "utf-8",
    stdio: "pipe",
    env: { ...process.env, ...env },
  });
  return {
    exitCode: result.status ?? 1,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
  };
}

// ── Directive file handling ───────────────────────────────────────
// When wt outputs directives (cd commands), forward them to WPI_DIRECTIVE_FILE
function runWt(
  tui: TUI,
  handle: OverlayHandle,
  args: string[],
): { exitCode: number } {
  const directiveFile = process.env.WPI_DIRECTIVE_FILE;
  const tmpFile = join(
    process.env.TMPDIR || "/tmp",
    `wpi-directive-${Date.now()}`,
  );

  const wtEnv: Record<string, string> = {
    WORKTRUNK_DIRECTIVE_FILE: tmpFile,
  };

  const result = runInteractive(tui, handle, "wt", args, wtEnv);

  // Forward directives to parent shell
  if (directiveFile && existsSync(tmpFile)) {
    const content = readFileSync(tmpFile, "utf-8");
    if (content.trim()) {
      writeFileSync(directiveFile, content, { flag: "a" });
    }
  }

  // Clean up
  if (existsSync(tmpFile)) {
    unlinkSync(tmpFile);
  }

  return { exitCode: result.exitCode };
}

// ── Stage implementations ────────────────────────────────────────

function stageCreateWorktree(
  tui: TUI,
  handle: OverlayHandle,
  statusContainer: Container,
  branchName: string,
): void {
  addStatus(
    statusContainer,
    tui,
    yellow(`Creating worktree for '${branchName}'...`),
  );

  const result = runWt(tui, handle, ["switch", "--create", branchName]);

  if (result.exitCode === 0) {
    addStatus(
      statusContainer,
      tui,
      green(`✓ Worktree created and switched to '${branchName}'`),
    );
  } else {
    addStatus(
      statusContainer,
      tui,
      red(`✗ Failed to create worktree (exit ${result.exitCode})`),
    );
  }
}

function stageStartPi(
  tui: TUI,
  handle: OverlayHandle,
  statusContainer: Container,
  extraArgs: string[] = [],
): void {
  const branch = getCurrentBranch();
  addStatus(statusContainer, tui, yellow(`Starting pi in '${branch}'...`));

  const args = [...extraArgs];
  if (args.length > 0) {
    args.push(
      "IMPORTANT: Do NOT call 'wt merge' yourself. Only fix the code. The user will run the merge manually when ready.",
    );
  }

  const result = runInteractive(tui, handle, "pi", args);
  addStatus(
    statusContainer,
    tui,
    result.exitCode === 0
      ? green(`✓ Pi exited successfully`)
      : red(`✓ Pi exited (code ${result.exitCode})`),
  );
}

function stageReview(
  tui: TUI,
  handle: OverlayHandle,
  statusContainer: Container,
): void {
  // Find merge base
  const sourceBranch =
    loadStates().find((s) => s.branch === getCurrentBranch())?.sourceBranch ||
    "main";
  const baseResult = runCapture("git", ["merge-base", sourceBranch, "HEAD"]);
  const mergeBase = baseResult.stdout.trim();

  if (!mergeBase) {
    addStatus(
      statusContainer,
      tui,
      red("✗ Could not determine merge base for review"),
    );
    return;
  }

  addStatus(statusContainer, tui, yellow("Opening nvim diff review..."));

  runInteractive(
    tui,
    handle,
    "nvim",
    ["-c", `lua require('git_diff_review').open('${mergeBase}')`],
    {
      WPI_BASE_REF: mergeBase,
    },
  );

  addStatus(statusContainer, tui, green("✓ Review session closed"));
}

function stageMerge(
  tui: TUI,
  handle: OverlayHandle,
  statusContainer: Container,
): void {
  // Find source branch from saved state, or default to current branch's source
  const branch = getCurrentBranch();
  const state = loadStates().find((s) => s.branch === branch);
  const sourceBranch = state?.sourceBranch || "main";

  addStatus(
    statusContainer,
    tui,
    yellow(`Merging '${branch}' → '${sourceBranch}'...`),
  );

  const result = runWt(tui, handle, [
    "merge",
    ...(sourceBranch ? [sourceBranch] : []),
  ]);

  if (result.exitCode === 0) {
    addStatus(statusContainer, tui, green(`✓ Merged to '${sourceBranch}'`));
    // Clear state on successful merge
    if (state) {
      const stateFile = join(STATE_DIR, `${state.repoId}-${branch}.state`);
      if (existsSync(stateFile)) unlinkSync(stateFile);
    }
  } else {
    addStatus(
      statusContainer,
      tui,
      red(
        `✗ Merge failed (exit ${result.exitCode}). Try 'wpi-backend --attach ${branch}' for retry flow.`,
      ),
    );
  }
}

// ── UI helpers ────────────────────────────────────────────────────

function addStatus(container: Container, tui: TUI, message: string) {
  container.addChild(new Text(message));
  tui.invalidate();
}

// ── Theme ─────────────────────────────────────────────────────────
function theme() {
  return {
    selectedPrefix: (text: string) => `\x1b[36m${text}\x1b[0m`,
    selectedText: (text: string) => `\x1b[1m${text}\x1b[0m`,
    description: (text: string) => `\x1b[2m${text}\x1b[0m`,
    scrollInfo: (text: string) => `\x1b[2m${text}\x1b[0m`,
    noMatch: (text: string) => `\x1b[2m${text}\x1b[0m`,
  };
}

// ── Build menu ────────────────────────────────────────────────────

type MenuStage = "create-worktree" | "start-pi" | "review" | "merge" | "attach";

function buildMenuItems(): SelectItem[] {
  const branch = getCurrentBranch();
  const states = loadStates();
  const hasWorktree = branch !== "???" && branch !== "";

  return [
    {
      value: "create-worktree",
      label: "Create worktree",
      description: "Create/switch to a worktree for a branch",
    },
    {
      value: "start-pi",
      label: "Start Pi",
      description: hasWorktree
        ? `Launch pi in '${branch}'`
        : "Launch pi in current directory",
    },
    {
      value: "review",
      label: "Review",
      description: "Open nvim diff review for changes",
    },
    {
      value: "merge",
      label: "Merge",
      description: hasWorktree
        ? `Squash-merge '${branch}' back to source`
        : "Squash-merge worktree back to source branch",
    },
    {
      value: "attach",
      label: "Attach",
      description:
        states.length > 0
          ? `Resume a session (${states.length} active)`
          : "No active sessions",
    },
  ];
}

// ── Main ──────────────────────────────────────────────────────────

const terminal = new ProcessTerminal();
const tui = new TUI(terminal);
tui.start();

// Header
const header = new Container();
header.addChild(new Text(bold("╲ wpi — Worktree + Pi ╱")));
header.addChild(new Spacer(1));
header.addChild(new Text(dim("↑↓ Navigate  ↵ Select  Esc Quit")));
header.addChild(new Spacer(1));

// Status area (shown after actions)
const statusContainer = new Container();

// Build initial menu
const menuItems = buildMenuItems();
const selectList = new SelectList(menuItems, menuItems.length, theme());

// Root container
const root = new Container();
root.addChild(header);
root.addChild(selectList);
root.addChild(new Spacer(1));
root.addChild(statusContainer);

const handle = tui.showOverlay(root, {
  anchor: "left-center",
  width: "80%",
  maxHeight: "90%",
});

tui.setFocus(selectList);

// ── Input mode for branch name ────────────────────────────────────
let inputMode = false;
let inputCallback: ((value: string) => void) | null = null;
const inputField = new Input();
inputField.onEscape = () => {
  inputMode = false;
  tui.setFocus(selectList);
  tui.invalidate();
};
inputField.onSubmit = (value) => {
  inputMode = false;
  tui.setFocus(null);
  tui.invalidate();
  if (inputCallback) {
    inputCallback(value);
    inputCallback = null;
  }
};

// ── Attach mode for session selection ─────────────────────────────
let attachMode = false;
let attachSelectList: SelectList | null = null;

function showAttachMenu() {
  const states = loadStates();
  if (states.length === 0) {
    addStatus(statusContainer, tui, dim("No active sessions to attach to."));
    return;
  }

  const items: SelectItem[] = states.map((s) => ({
    value: s.branch,
    label: s.branch,
    description: `stage: ${s.stage}`,
  }));

  attachSelectList = new SelectList(items, items.length, {
    selectedPrefix: (text) => `\x1b[36m${text}\x1b[0m`,
    selectedText: (text) => `\x1b[1m${text}\x1b[0m`,
    description: (text) => `\x1b[2m${text}\x1b[0m`,
    scrollInfo: (text) => `\x1b[2m${text}\x1b[0m`,
    noMatch: (text) => `\x1b[2m${text}\x1b[0m`,
  });

  attachSelectList.onSelect = (item) => {
    attachMode = false;
    tui.setFocus(null);
    tui.invalidate();

    // Switch to the worktree then reopen the TUI — the user can now
    // pick the stage they want to resume from.
    const branch = item.value;
    addStatus(
      statusContainer,
      tui,
      yellow(`Switching to worktree '${branch}'...`),
    );
    runWt(tui, handle, ["switch", branch]);
    refreshMenu();
    addStatus(
      statusContainer,
      tui,
      green(`✓ Switched to '${branch}'. Pick a stage to continue.`),
    );
    tui.setFocus(selectList);
  };

  attachSelectList.onCancel = () => {
    attachMode = false;
    tui.setFocus(selectList);
    tui.invalidate();
  };

  attachMode = true;
  tui.setFocus(attachSelectList);
  tui.invalidate();
}

// Mutable ref so stage handlers always point to the current menu
const menuRef: { current: SelectList } = { current: selectList };

// ── Refresh menu with current state ───────────────────────────────
function refreshMenu() {
  const items = buildMenuItems();
  const newSelectList = new SelectList(items, items.length, theme());

  // Wire up the same handlers
  newSelectList.onSelect = menuRef.current.onSelect;
  newSelectList.onCancel = menuRef.current.onCancel;

  // Replace in root container
  const idx = root.children.indexOf(menuRef.current);
  if (idx >= 0) {
    root.children[idx] = newSelectList;
  }

  menuRef.current = newSelectList;
  tui.setFocus(newSelectList);
  tui.invalidate();
}

// ── Stage selection handler ───────────────────────────────────────
selectList.onSelect = (item) => {
  const stage = item.value as MenuStage;

  switch (stage) {
    case "create-worktree": {
      // Show branch name input
      inputMode = true;
      inputField.setValue("");
      tui.setFocus(inputField);
      tui.invalidate();

      inputCallback = (branchName) => {
        if (!branchName.trim()) {
          addStatus(statusContainer, tui, dim("Cancelled — no branch name."));
          tui.setFocus(menuRef.current);
          return;
        }
        stageCreateWorktree(tui, handle, statusContainer, branchName.trim());
        refreshMenu();
        tui.setFocus(menuRef.current);
      };
      break;
    }

    case "start-pi": {
      tui.setFocus(null);
      stageStartPi(tui, handle, statusContainer);
      refreshMenu();
      tui.setFocus(menuRef.current);
      break;
    }

    case "review": {
      tui.setFocus(null);
      stageReview(tui, handle, statusContainer);
      refreshMenu();
      tui.setFocus(menuRef.current);
      break;
    }

    case "merge": {
      tui.setFocus(null);
      stageMerge(tui, handle, statusContainer);
      refreshMenu();
      tui.setFocus(menuRef.current);
      break;
    }

    case "attach": {
      showAttachMenu();
      break;
    }
  }
};

selectList.onCancel = () => {
  handle.hide();
  tui.stop();
  process.exit(0);
};

// ── Custom render for input mode ──────────────────────────────────
// We need to show the input field when in input mode.
// Patch the root container's render to inject the input field.
const originalRender = root.render.bind(root);
root.render = function (width: number): string[] {
  const lines = originalRender(width);

  if (inputMode) {
    // Find where the selectList is and insert input before it
    const inputLines = inputField.render(width);
    const promptLine = `\x1b[1mBranch name:\x1b[0m ${inputLines[0] || ""}`;
    // Replace the menu area with the input prompt
    // Find the first menu line (after header) and replace
    const headerEnd = 4; // header has 4 lines (title + spacer + hints + spacer)
    if (lines.length > headerEnd) {
      lines.splice(headerEnd, lines.length - headerEnd, promptLine);
    }
  }

  if (attachMode && attachSelectList) {
    const attachLines = attachSelectList.render(width);
    const headerEnd = 4;
    if (lines.length > headerEnd) {
      lines.splice(headerEnd, lines.length - headerEnd, ...attachLines);
    }
  }

  return lines;
};

root.invalidate = function () {
  // Invalidate all children
  for (const child of root.children) {
    child.invalidate();
  }
  inputField.invalidate();
  tui.invalidate();
};

// ── Process signals ───────────────────────────────────────────────
process.on("SIGINT", () => {
  handle.hide();
  tui.stop();
  process.exit(0);
});

process.on("unhandledRejection", (err) => {
  console.error("Unhandled rejection:", err);
  handle.hide();
  tui.stop();
  process.exit(1);
});

process.on("uncaughtException", (err) => {
  console.error("Uncaught exception:", err);
  handle.hide();
  tui.stop();
  process.exit(1);
});
