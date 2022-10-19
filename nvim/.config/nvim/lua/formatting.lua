-- formatter setup
local prettier = require("formatter.defaults.prettierd")

require("formatter").setup({
	logging = true,
	log_level = vim.log.levels.WARN,
	filetype = {
		javascript = prettier,
		typescript = require("formatter.filetypes.typescript").prettierd,
		vue = prettier,
		python = require("formatter.filetypes.python").black,
		graphql = prettier,
		prisma = prettier,
		lua = require("formatter.filetypes.lua").stylua,
	},
})
vim.api.nvim_exec(
	[[
augroup FormatAutogroup
  autocmd!
  autocmd BufWritePost * FormatWriteLock
augroup END
]],
	true
) -- auto format on save
