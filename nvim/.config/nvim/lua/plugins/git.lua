return {
  {
    "lewis6991/gitsigns.nvim",
    lazy = false,
    opts = function()
      local opts = {
        current_line_blame = true,
        attach_to_untracked = true,
        signs = {
          add = { text = "+" },
          change = { text = "~" },
          delete = { text = "_" },
          topdelete = { text = "‾" },
          changedelete = { text = "~" },
        },
      }

      -- Resolve base ref: priority is env vars, then merge-base with main
      -- This matches git_diff_review.resolve_base_ref() behavior
      local function resolve_base_ref()
        local env_ref = vim.env.WPI_BASE_REF or vim.env.WPI_BASE_BRANCH
        if env_ref and env_ref ~= "" then
          return env_ref
        end
        -- Fallback: merge-base with main branch
        local ok, result = pcall(vim.fn.systemlist, { cmd = "git merge-base main HEAD" })
        if ok and vim.v.shell_error == 0 and #result > 0 then
          return result[1]
        end
        return "HEAD"
      end

      -- When launched from wpi review step, diff against the base ref
      -- so gutter signs show all changes pi made (not just uncommitted ones).
      local base_ref = vim.env.WPI_BASE_REF or vim.env.WPI_BASE_BRANCH
      if base_ref then
        opts.base = base_ref
      end

      opts.on_attach = function(bufnr)
        local gs = require("gitsigns")

        local function map(mode, lhs, rhs, desc)
          vim.keymap.set(mode, lhs, rhs, { buffer = bufnr, desc = desc })
        end

        -- Side-by-side diff of current file vs base (synced with git_diff_review)
        local diff_base = resolve_base_ref()
        map("n", "<leader>gd", function()
          gs.diffthis(diff_base)
        end, "Diff file vs base (git)")

        -- Navigate between changed hunks
        map("n", "]h", function()
          gs.nav_hunk("next")
        end, "Next hunk")
        map("n", "[h", function()
          gs.nav_hunk("prev")
        end, "Prev hunk")
      end
      return opts
    end,
  },
  {
    "akinsho/git-conflict.nvim",
    version = "*",
    config = true,
  },
}
