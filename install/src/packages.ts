import type { CheckboxItem } from "./checkbox-list.js";
import { execSync } from "child_process";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DOTFILES_ROOT = resolve(__dirname, "../..");

export interface DotfilePackage extends CheckboxItem {
  install: () => string | Promise<string>; // Returns what was done
}

export const PACKAGES: DotfilePackage[] = [
  {
    id: "bashrc",
    label: "Bash",
    description: "Shell config, aliases, secrets, fzf",
    checked: true,
    install: () => stow("bashrc"),
  },
  {
    id: "nvim",
    label: "Neovim",
    description: "Lazy.nvim, LSP, blink.cmp, CodeCompanion",
    checked: true,
    install: () => stow("nvim"),
  },
  {
    id: "tmux",
    label: "Tmux",
    description: "Ctrl+a prefix, vi copy, Tokyo Night",
    checked: true,
    install: () => stow("tmux"),
  },
  {
    id: "wt",
    label: "Worktrunk",
    description: "Git worktree management + AI commits",
    checked: true,
    install: () => stow("wt"),
  },
  {
    id: "pi",
    label: "Pi agent",
    description: "AI coding assistant, extensions, skills",
    checked: false,
    install: () => stow("pi"),
  },
  {
    id: "docker",
    label: "Docker services",
    description: "Jellyfin, audiobookshelf, NPM, transmission, Wolf",
    checked: false,
    install: () => stow("docker"),
  },
  {
    id: "opencode",
    label: "Opencode",
    description: "Alternative AI assistant config",
    checked: false,
    install: () => stow("opencode"),
  },
  {
    id: "scripts",
    label: "Git hooks",
    description: "Pre-commit hooks for formatting & linting",
    checked: false,
    install: () => stow("scripts"),
  },
  {
    id: "homebrew",
    label: "Homebrew",
    description: "Brewfile for system packages",
    checked: false,
    install: () => {
      execSync("brew bundle --file=./homebrew/Brewfile", {
        cwd: DOTFILES_ROOT,
        stdio: "pipe",
      });
      return "Installed Homebrew packages from Brewfile";
    },
  },
  {
    id: "mise",
    label: "Mise runtimes",
    description: "Python, Lua, Node, Bun, tooling (ruff, stylua, etc.)",
    checked: true,
    install: () => {
      execSync("mise install", {
        cwd: DOTFILES_ROOT,
        stdio: "pipe",
      });
      return "Installed runtimes via mise";
    },
  },
  {
    id: "m908",
    label: "Redragon M908",
    description: "Mouse macro configuration",
    checked: false,
    install: () => stow("m908"),
  },
  {
    id: "pass-cli",
    label: "Proton Pass CLI",
    description: "Secret injection for API keys",
    checked: true,
    install: () => {
      if (checkPassCliInstalled()) {
        return "Already installed";
      }
      execSync(
        "curl -fsSL https://proton.me/download/pass-cli/install.sh | bash",
        { stdio: "pipe" },
      );
      return "Installed pass-cli";
    },
  },
];

function stow(pkg: string): string {
  execSync(`stow ${pkg}`, { cwd: DOTFILES_ROOT, stdio: "pipe" });
  return `Stowed ${pkg}`;
}

export function checkStowAvailable(): boolean {
  try {
    execSync("which stow", { stdio: "pipe" });
    return true;
  } catch {
    return false;
  }
}

function checkPassCliInstalled(): boolean {
  try {
    execSync("command -v pass-cli", { stdio: "pipe" });
    return true;
  } catch {
    return false;
  }
}
