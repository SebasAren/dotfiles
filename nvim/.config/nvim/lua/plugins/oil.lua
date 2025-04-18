return {
	{
		"stevearc/oil.nvim",
		--- @module 'oil'
		--- @type oil.SetupOpts
		opts = {},
		keys = {
			{
				"<leader>nn",
				"<cmd>Oil --float<cr>",
				desc = "Open Oil netrw in float",
			},
			{
				"<leader>nf",
				"<cmd>Oil<cr>",
				desc = "Open oil netrw",
			},
		},
		dependencies = {
			{ "echasnovski/mini.nvim" },
		},
		lazy = false,
	},
}
