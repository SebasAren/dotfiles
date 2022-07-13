local prettierSetup = {
  function()
    return {
      exe = "prettier",
      args = {"--stdin-filepath", vim.fn.fnameescape(vim.api.nvim_buf_get_name(0))},
      stdin = true,
    }
  end
}

local blackSetup = {
  function()
    return {
      exe = "black",
      args = { '-' },
      stdin = true,
    }
  end
}
-- formatter setup
require('formatter').setup({
  filetype = {
    javascript = prettierSetup,
    typescript = prettierSetup,
    vue = prettierSetup,
    python = blackSetup,
    graphql = prettierSetup
  },
})
vim.api.nvim_exec([[
augroup FormatAutogroup
  autocmd!
  autocmd BufWritePost *.js,*.vue,*.ts,*.py,*.graphql FormatWrite
augroup END
]], true) -- auto format on save
