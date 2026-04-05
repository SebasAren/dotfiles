import { describe, it, expect } from "bun:test";
import {
  isSafeCommand,
  cleanStepText,
  extractTodoItems,
  extractDoneSteps,
  markCompletedSteps,
  type TodoItem,
} from "./utils.js";

// ---------------------------------------------------------------------------
// isSafeCommand
// ---------------------------------------------------------------------------

describe("isSafeCommand", () => {
  describe("allows read-only commands", () => {
    const safeCommands = [
      "cat file.txt",
      "head -n 10 file.txt",
      "tail -f log.txt",
      "grep pattern file",
      "find . -name '*.ts'",
      "ls -la",
      "pwd",
      "echo hello",
      "printf '%s' value",
      "wc -l file.txt",
      "sort file.txt",
      "uniq -c",
      "diff a.txt b.txt",
      "file image.png",
      "stat file.txt",
      "du -sh .",
      "df -h",
      "tree -L 2",
      "which node",
      "whereis python",
      "type curl",
      "env",
      "printenv PATH",
      "uname -a",
      "whoami",
      "id",
      "date",
      "cal",
      "uptime",
      "ps aux",
      "free -h",
      "git status",
      "git log --oneline",
      "git diff HEAD~1",
      "git show abc123",
      "git branch -a",
      "git remote -v",
      "git config --get user.name",
      "git ls-files",
      "npm list",
      "npm ls --depth=0",
      "npm view react",
      "npm info express",
      "npm outdated",
      "yarn list",
      "yarn info react",
      "node --version",
      "python --version",
      "curl https://example.com",
      "jq '.name' package.json",
      "rg 'pattern' .",
      "fd '.ts$'",
      "bat README.md",
      "exa -la",
      "awk '{print $1}' file",
      "sed -n '1,10p' file",
    ];

    for (const cmd of safeCommands) {
      it(`allows: ${cmd}`, () => {
        expect(isSafeCommand(cmd)).toBe(true);
      });
    }
  });

  describe("blocks destructive commands", () => {
    const destructiveCommands = [
      "rm file.txt",
      "rm -rf /",
      "rmdir dir",
      "mv a.txt b.txt",
      "cp a.txt b.txt",
      "mkdir newdir",
      "touch newfile",
      "chmod 755 script.sh",
      "chown user:group file",
      "chgrp group file",
      "ln -s target link",
      "tee output.txt",
      "truncate -s 0 file",
      "dd if=/dev/zero of=file",
      "shred file.txt",
      "echo hello > file.txt",
      "echo hello >> file.txt",
      "npm install express",
      "npm uninstall react",
      "npm update",
      "npm ci",
      "yarn add react",
      "yarn remove react",
      "pnpm add lodash",
      "pip install flask",
      "apt-get install vim",
      "apt remove vim",
      "brew install node",
      "git add .",
      "git commit -m 'msg'",
      "git push",
      "git pull",
      "git merge main",
      "git rebase main",
      "git reset HEAD~1",
      "git checkout -b new",
      "git branch -d old",
      "git stash",
      "git cherry-pick abc",
      "git revert abc",
      "git tag v1.0",
      "git init",
      "git clone https://...",
      "sudo rm -rf /",
      "su root",
      "kill 1234",
      "pkill node",
      "killall node",
      "reboot",
      "shutdown now",
      "systemctl start nginx",
      "systemctl stop nginx",
      "service nginx start",
      "vim file.txt",
      "vi file.txt",
      "nano file.txt",
      "emacs file.txt",
      "code .",
      "subl file.txt",
    ];

    for (const cmd of destructiveCommands) {
      it(`blocks: ${cmd}`, () => {
        expect(isSafeCommand(cmd)).toBe(false);
      });
    }
  });

  describe("edge cases", () => {
    it("blocks commands that are both safe-pattern and destructive-pattern", () => {
      // e.g. 'echo hello > file' matches both echo (safe) and > (destructive)
      expect(isSafeCommand("echo hello > out.txt")).toBe(false);
    });

    it("blocks unknown commands (not in safe list)", () => {
      expect(isSafeCommand("docker run ubuntu")).toBe(false);
      expect(isSafeCommand("python script.py")).toBe(false);
      expect(isSafeCommand("make build")).toBe(false);
    });

    it("handles empty string", () => {
      expect(isSafeCommand("")).toBe(false);
    });

    it("handles commands with leading whitespace", () => {
      expect(isSafeCommand("  ls -la")).toBe(true);
      expect(isSafeCommand("  rm file")).toBe(false);
    });
  });
});

// ---------------------------------------------------------------------------
// cleanStepText
// ---------------------------------------------------------------------------

describe("cleanStepText", () => {
  it("removes bold markers", () => {
    expect(cleanStepText("**important** step")).toBe("Important step");
  });

  it("removes italic markers", () => {
    expect(cleanStepText("*emphasis* here")).toBe("Emphasis here");
  });

  it("removes inline code and strips verb", () => {
    // Backticks removed, then "Run " verb stripped, then capitalized
    expect(cleanStepText("Run `npm test`")).toBe("Npm test");
  });

  it("strips leading action verbs", () => {
    expect(cleanStepText("Create the new module")).toBe("New module");
    expect(cleanStepText("Update configuration file")).toBe("Configuration file");
    expect(cleanStepText("Remove old files")).toBe("Old files");
    expect(cleanStepText("Add new plugin")).toBe("New plugin");
  });

  it("capitalizes first character after verb stripping", () => {
    // "check" matches the verb regex with /i flag
    expect(cleanStepText("check the logs")).toBe("Logs");
    // Non-verb text gets capitalized
    expect(cleanStepText("verify connectivity")).toBe("Connectivity");
  });

  it("truncates text over 50 characters", () => {
    const long = "a".repeat(60);
    const result = cleanStepText(long);
    expect(result.length).toBe(50);
    expect(result.endsWith("...")).toBe(true);
  });

  it("returns empty string for short text after cleaning", () => {
    expect(cleanStepText("ab")).toBe("Ab");
  });

  it("normalizes whitespace", () => {
    expect(cleanStepText("step   with   spaces")).toBe("Step with spaces");
  });
});

// ---------------------------------------------------------------------------
// extractTodoItems
// ---------------------------------------------------------------------------

describe("extractTodoItems", () => {
  it("extracts numbered items after Plan: header", () => {
    const message = `Here's my analysis.

Plan:
1. Read the configuration files
2. Update the database schema
3. Write unit tests

Let me know if this looks good.`;

    const items = extractTodoItems(message);
    expect(items).toHaveLength(3);
    // cleanStepText strips leading verbs: "Read the " → "Configuration files"
    expect(items[0]).toEqual({ step: 1, text: "Configuration files", completed: false });
    expect(items[1]).toEqual({ step: 2, text: "Database schema", completed: false });
    expect(items[2]).toEqual({ step: 3, text: "Unit tests", completed: false });
  });

  it("extracts items with bold Plan: header", () => {
    const message = `**Plan:**
1. First step here with enough text`;
    const items = extractTodoItems(message);
    expect(items).toHaveLength(1);
    expect(items[0].step).toBe(1);
  });

  it("extracts items with parenthesized numbering", () => {
    const message = `Plan:
1) Read the configuration files
2) Update the database schema properly`;
    const items = extractTodoItems(message);
    expect(items).toHaveLength(2);
  });

  it("returns empty array when no Plan: header", () => {
    expect(extractTodoItems("Just a regular message without a plan")).toHaveLength(0);
  });

  it("returns empty array when Plan: has no numbered items", () => {
    expect(extractTodoItems("Plan:\nJust a paragraph without numbers")).toHaveLength(0);
  });

  it("skips items shorter than 5 characters and re-numbers", () => {
    const message = `Plan:
1. Short
2. This is a long enough step description`;
    const items = extractTodoItems(message);
    expect(items).toHaveLength(1);
    // Steps are re-numbered from 1, not preserving original numbers
    expect(items[0].step).toBe(1);
  });

  it("skips items starting with backtick", () => {
    const message = `Plan:
1. \`code block item\` with enough text still`;
    const items = extractTodoItems(message);
    expect(items).toHaveLength(0);
  });

  it("skips items starting with slash", () => {
    const message = `Plan:
1. /absolute/path/to/something here`;
    const items = extractTodoItems(message);
    expect(items).toHaveLength(0);
  });

  it("skips items starting with dash", () => {
    const message = `Plan:
1. - dashed item with enough text`;
    const items = extractTodoItems(message);
    expect(items).toHaveLength(0);
  });

  it("handles bold step text", () => {
    const message = `Plan:
1. **Read the configuration** files`;
    const items = extractTodoItems(message);
    expect(items).toHaveLength(1);
    // Bold markers stripped, then verb "Read the " stripped → "Configuration"
    expect(items[0].text).toBe("Configuration");
  });

  it("assigns sequential step numbers starting from 1", () => {
    const message = `Plan:
1. First step description
2. Second step description
3. Third step description`;
    const items = extractTodoItems(message);
    expect(items.map((i) => i.step)).toEqual([1, 2, 3]);
  });

  it("all items start as incomplete", () => {
    const message = `Plan:
1. First step description here
2. Second step description here`;
    const items = extractTodoItems(message);
    expect(items.every((i) => i.completed === false)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// extractDoneSteps
// ---------------------------------------------------------------------------

describe("extractDoneSteps", () => {
  it("extracts DONE markers from text", () => {
    const text = "Completed step 1 [DONE:1] and step 3 [DONE:3]";
    expect(extractDoneSteps(text)).toEqual([1, 3]);
  });

  it("is case-insensitive", () => {
    expect(extractDoneSteps("[done:1] [Done:2] [DONE:3]")).toEqual([1, 2, 3]);
  });

  it("returns empty array when no markers", () => {
    expect(extractDoneSteps("No done markers here")).toEqual([]);
  });

  it("handles multiple markers for same step", () => {
    // Duplicates are possible but the function just extracts all matches
    const result = extractDoneSteps("[DONE:1] [DONE:1]");
    expect(result).toEqual([1, 1]);
  });

  it("extracts multi-digit step numbers", () => {
    expect(extractDoneSteps("[DONE:12] [DONE:99]")).toEqual([12, 99]);
  });
});

// ---------------------------------------------------------------------------
// markCompletedSteps
// ---------------------------------------------------------------------------

describe("markCompletedSteps", () => {
  it("marks matching steps as completed", () => {
    const items: TodoItem[] = [
      { step: 1, text: "First", completed: false },
      { step: 2, text: "Second", completed: false },
      { step: 3, text: "Third", completed: false },
    ];
    const count = markCompletedSteps("[DONE:1] [DONE:3]", items);
    expect(count).toBe(2);
    expect(items[0].completed).toBe(true);
    expect(items[1].completed).toBe(false);
    expect(items[2].completed).toBe(true);
  });

  it("ignores DONE markers for non-existent steps", () => {
    const items: TodoItem[] = [{ step: 1, text: "First", completed: false }];
    const count = markCompletedSteps("[DONE:5]", items);
    expect(count).toBe(1);
    expect(items[0].completed).toBe(false);
  });

  it("returns 0 when no DONE markers", () => {
    const items: TodoItem[] = [{ step: 1, text: "First", completed: false }];
    expect(markCompletedSteps("no markers", items)).toBe(0);
    expect(items[0].completed).toBe(false);
  });

  it("handles empty text", () => {
    const items: TodoItem[] = [{ step: 1, text: "First", completed: false }];
    expect(markCompletedSteps("", items)).toBe(0);
  });

  it("handles empty items array", () => {
    expect(markCompletedSteps("[DONE:1]", [])).toBe(1);
  });

  it("does not unmark already completed steps", () => {
    const items: TodoItem[] = [{ step: 1, text: "First", completed: true }];
    markCompletedSteps("[DONE:1]", items);
    expect(items[0].completed).toBe(true);
  });
});
