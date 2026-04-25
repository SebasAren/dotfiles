return {
  settings = {
    validate = "on",
    packageManager = "pnpm",
  },
  root_dir = function(bufnr, on_dir)
    local fname = vim.api.nvim_buf_get_name(bufnr)
    -- Never attach to files inside .claude/worktrees
    if fname:find("/%.claude/worktrees/") then
      return
    end
    local root_markers = {
      "eslint.config.js",
      "eslint.config.mjs",
      "eslint.config.cjs",
      "eslint.config.ts",
      ".eslintrc.js",
      ".eslintrc.mjs",
      ".eslintrc.cjs",
      ".eslintrc.json",
      ".eslintrc",
      "package.json",
    }
    local root = vim.fs.root(bufnr, root_markers) or vim.fn.getcwd()
    on_dir(root)
  end,
}
