return {
	{
		"akinsho/bufferline.nvim",
		version = "*",
		lazy = false,
		dependencies = "nvim-tree/nvim-web-devicons",
		keys = {
			{
				"<leader>bn",
				function()
					require("bufferline").cycle(1)
				end,
				desc = "Go to next buffer",
			},
			{
				"<leader>bp",
				function()
					require("bufferline").cycle(-1)
				end,
				desc = "Go to previous buffer",
			},
			{
				"<leader>bc",
				function()
					require("bufferline").close_with_pick()
				end,
				desc = "Close buffer on pick",
			},
			{
				"<leader>bo",
				function()
					require("bufferline").close_others()
				end,
				desc = "Close other buffers",
			},
		},
		---@type bufferline.UserConfig
		opts = { options = { diagnostics = "nvim_lsp" } },
	},
}
