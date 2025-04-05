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
