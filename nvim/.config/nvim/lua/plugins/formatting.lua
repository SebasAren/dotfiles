return {
	{
		"mhartington/formatter.nvim",
		config = function()
			local prettier = require("formatter.defaults.prettierd")

			require("formatter").setup({
				logging = true,
				log_level = vim.log.levels.DEBUG,
				filetype = {
					javascript = prettier,
					typescript = require("formatter.filetypes.typescript").prettierd,
					typescriptreact = prettier,
					javascriptreact = prettier,
					vue = prettier,
					python = require("formatter.filetypes.python").black,
					graphql = prettier,
					prisma = prettier,
					html = prettier,
					lua = require("formatter.filetypes.lua").stylua,
					nix = require("formatter.filetypes.nix").nixfmt,
					["*"] = require("formatter.filetypes.any").remove_trailing_whitespace,
				},
			})
		end,
	}, -- formatting
	{ "tpope/vim-surround" },
}
