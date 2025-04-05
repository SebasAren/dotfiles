return {
	{
		"echasnovski/mini.nvim",
		version = false,
		config = function()
			-- highlighting of word under cursor
			require("mini.cursorword").setup({})
			-- autopairing
			require("mini.pairs").setup({})
			-- trailing space highlight
			require("mini.trailspace").setup({})
			-- commenter
			require("mini.comment").setup({})
			-- move objects
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
		end,
		require("mini.surround").setup({}),
		require("mini.splitjoin").setup({
			mappings = {
				toggle = "<leader>a",
			},
		}),
		require("mini.icons").setup({}),
	},
}
