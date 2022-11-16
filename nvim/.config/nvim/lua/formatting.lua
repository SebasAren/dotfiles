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
		["*"] = require("formatter.filetypes.any").remove_trailing_whitespace,
	},
})
local formatGroup = vim.api.nvim_create_augroup("FormatAutogroup", { clear = true })
vim.api.nvim_create_autocmd("BufWritePost", {
	command = "FormatWriteLock",
	group = formatGroup,
})
