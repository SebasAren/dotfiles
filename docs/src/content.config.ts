import { defineCollection } from "astro:content";
import { glob } from "astro/loaders";

const tools = defineCollection({
  loader: glob({
    base: "../",
    pattern: "{AGENTS.md,nvim/README.md,tmux/README.md,bashrc/AGENTS.md,pi/.pi/README.md,obsidian/AGENTS.md}",
  }),
});

export const collections = { tools };
