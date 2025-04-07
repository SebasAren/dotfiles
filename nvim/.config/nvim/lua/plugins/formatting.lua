return {
	{
		"mhartington/formatter.nvim",
		config = function()
			local prettier = require("formatter.defaults.prettierd")

			require("formatter").setup({
				-- Enable logging for debugging purposes
				logging = true,
				-- Set log level to DEBUG for detailed output
				log_level = vim.log.levels.DEBUG,
				-- Configure formatters per filetype
				filetype = {
					-- JavaScript/TypeScript family
					javascript = prettier,
					typescript = require("formatter.filetypes.typescript").prettierd,
					typescriptreact = prettier,
					javascriptreact = prettier,
					-- Vue files
					vue = prettier,
					-- Python formatter
					python = require("formatter.filetypes.python").black,
					-- GraphQL and Prisma
					graphql = prettier,
					prisma = prettier,
					-- HTML formatting
					html = prettier,
					-- Lua formatter
					lua = require("formatter.filetypes.lua").stylua,
					-- Nix formatter
					nix = require("formatter.filetypes.nix").nixfmt,
					-- Default formatter for all other filetypes
					["*"] = require("formatter.filetypes.any").remove_trailing_whitespace,
				},
			})

			local formatGroup = vim.api.nvim_create_augroup("FormatAutogroup", { clear = true })
			local is_formatting_enabled = true

			local function toggle_formatting()
				is_formatting_enabled = not is_formatting_enabled
				if is_formatting_enabled then
					vim.api.nvim_create_autocmd("BufWritePost", {
						command = "FormatWriteLock",
						group = formatGroup,
					})
					vim.notify("Auto-formatting enabled", vim.log.levels.INFO)
				else
					vim.api.nvim_clear_autocmds({ group = formatGroup })
					vim.notify("Auto-formatting disabled", vim.log.levels.WARN)
				end
			end

			-- Set up the autocmd initially
			vim.api.nvim_create_autocmd("BufWritePost", {
				command = "FormatWriteLock",
				group = formatGroup,
			})

			-- Keybind to toggle auto-formatting (e.g., <leader>tf)
			vim.keymap.set("n", "<leader>tf", toggle_formatting, { desc = "Toggle auto-formatting" })
		end,
	},
}
