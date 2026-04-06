import {
  Container,
  Text,
  Spacer,
  TUI,
  ProcessTerminal,
} from "@mariozechner/pi-tui";
import { CheckboxList, type CheckboxItem } from "./checkbox-list.js";
import { PACKAGES, isStowInstalled } from "./packages.js";

// ANSI helpers
const bold = (s: string) => `\x1b[1m${s}\x1b[0m`;
const dim = (s: string) => `\x1b[2m${s}\x1b[0m`;

// ─── Setup TUI ────────────────────────────────────────────────────
const terminal = new ProcessTerminal();
const tui = new TUI(terminal);
tui.start();

// ─── Build UI ─────────────────────────────────────────────────────
const header = new Container();
header.addChild(new Text(bold("╲ Dotfiles Installer ╱")));
header.addChild(new Spacer(1));
header.addChild(new Text(dim("↑↓ Navigate  ␣ Toggle  ↵ Install  Esc Quit")));
header.addChild(new Spacer(1));

const checkboxItems: CheckboxItem[] = PACKAGES.map((p) => ({
  id: p.id,
  label: p.label,
  description: p.description,
  checked: isStowInstalled(p.id) || p.checked,
}));

const checkboxList = new CheckboxList(checkboxItems);

const statusContainer = new Container();

const root = new Container();
root.addChild(header);
root.addChild(checkboxList);
root.addChild(new Spacer(1));
root.addChild(statusContainer);

// Show as overlay
const handle = tui.showOverlay(root, {
  anchor: "left-center",
  width: "80%",
  maxHeight: "90%",
});

tui.setFocus(checkboxList);

// ─── Status helpers ───────────────────────────────────────────────
function addStatus(message: string) {
  statusContainer.addChild(new Text(message));
  tui.invalidate();
}

function addSpacer() {
  statusContainer.addChild(new Spacer(1));
}

// ─── Install logic ────────────────────────────────────────────────
async function runInstall(selected: CheckboxItem[]) {
  const packages = PACKAGES.filter((p) => selected.some((s) => s.id === p.id));

  if (packages.length === 0) {
    addStatus(dim("Nothing selected. Press Esc to quit."));
    return;
  }

  addSpacer();
  addStatus(bold(`Installing ${packages.length} package(s)...`));
  addSpacer();

  let success = 0;
  let failed = 0;

  for (const pkg of packages) {
    // Add pending status text
    const pendingText = new Text(`  ⏳ ${pkg.label}...`);
    statusContainer.addChild(pendingText);
    tui.invalidate();

    try {
      const result = await pkg.install();
      // Replace pending with success
      statusContainer.removeChild(pendingText);
      statusContainer.addChild(new Text(`  ✓ ${pkg.label} — ${result}`));
      success++;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      statusContainer.removeChild(pendingText);
      statusContainer.addChild(new Text(`  ✗ ${pkg.label} — ${msg}`));
      failed++;
    }

    tui.invalidate();
  }

  addSpacer();
  if (failed === 0) {
    addStatus(bold(`All done! ${success}/${packages.length} installed.`));
  } else {
    addStatus(
      bold(`Done: ${success} ok, ${failed} failed (${success + failed} total)`),
    );
  }
  addStatus(dim("Press Esc to exit."));
}

// ─── Input handling ───────────────────────────────────────────────
let installing = false;

checkboxList.onSubmit = async (selected) => {
  if (installing) return;
  installing = true;
  tui.setFocus(null);
  await runInstall(selected);
  tui.setFocus(checkboxList);
};

checkboxList.onCancel = () => {
  handle.hide();
  tui.stop();
  process.exit(0);
};

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
