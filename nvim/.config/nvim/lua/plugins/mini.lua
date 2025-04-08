return {
	{
		"echasnovski/mini.nvim",
		version = false,
		dependencies = {
			"rafamadriz/friendly-snippets",
		},
		config = function()
			-- Highlight the word under the cursor
			require("mini.cursorword").setup({})
			-- Automatically insert or delete pairs (e.g., brackets, quotes)
			require("mini.pairs").setup({})
			-- Highlight trailing whitespace
			require("mini.trailspace").setup({})
			-- Comment/uncomment lines with ease
			require("mini.comment").setup({})
			-- Move lines or visual selections with custom keybindings
			require("mini.move").setup({
				mappings = {
					-- Move visual selection in Visual mode
					left = "<C-M-h>",
					right = "<C-M-l>",
					down = "<C-M-j>",
					up = "<C-M-k>",

					-- Move current line in Normal mode
					line_left = "<C-M-h>",
					line_right = "<C-M-l>",
					line_down = "<C-M-j>",
					line_up = "<C-M-k>",
				},
			})
			-- Toggle between single-line and multi-line code blocks
			require("mini.splitjoin").setup({
				mappings = {
					toggle = "<leader>J",
				},
			})
			-- Display icons for file types and other UI elements
			require("mini.icons").setup({})
			-- Snippet engine for code snippets
			local gen_loader = require("mini.snippets").gen_loader
			require("mini.snippets").setup({
				snippets = {
					gen_loader.from_lang(),
				},
			})
			-- Enhanced completion with fuzzy filtering
			require("mini.completion").setup({
				lsp_completion = {
					process_items = function(items, base)
						return MiniCompletion.default_process_items(items, base, { filtersort = "fuzzy" })
					end,
				},
			})
		end,
	},
}
