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
    id: "m908",
    label: "Redragon M908",
    description: "Mouse macro configuration",
    checked: false,
    install: () => stow("m908"),
  },

];

function stow(pkg: string): string {
  try {
    execSync(`stow --restow ${pkg}`, { cwd: DOTFILES_ROOT, stdio: "pipe" });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`Stow failed for ${pkg}: ${msg.slice(0, 200)}`);
  }
  return `Stowed ${pkg}`;
}

// Check if a stow package is already installed by checking if target symlinks exist
export function isStowInstalled(pkg: string): boolean {
  // Map of package IDs to their main target files/directories
  const packageTargets: Record<string, string> = {
    bashrc: `${process.env.HOME}/.bashenv`,
    nvim: `${process.env.HOME}/.config/nvim`,
    tmux: `${process.env.HOME}/.config/tmux`,
    wt: `${process.env.HOME}/.config/worktrunk`,
    pi: `${process.env.HOME}/.pi`,
    docker: `${process.env.HOME}/.docker`,
    opencode: `${process.env.HOME}/.config/opencode`,
    m908: `${process.env.HOME}/.config/m908`,
  };

  const target = packageTargets[pkg];
  if (!target) return false;

  return isStowFileInstalled(target);
}

export function checkStowAvailable(): boolean {
  try {
    execSync("which stow", { stdio: "pipe" });
    return true;
  } catch {
    return false;
  }
}


// Check if a specific stow-managed file/symlink exists
function isStowFileInstalled(targetPath: string): boolean {
  try {
    const stats = require("fs").lstatSync(targetPath);
    return stats.isSymbolicLink();
  } catch {
    return false;
  }
}
