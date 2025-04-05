return {
	{
		"ibhagwan/fzf-lua",
		dependencies = { "echasnovski/mini.icons" },
		opts = {},
		keys = {
			{
				"<leader>p",
				function()
					require("fzf-lua").files()
				end,
				desc = "Open FZF-Lua files picker",
			},
			{
				"<leader>rg",
				function()
					require("fzf-lua").grep()
				end,
				desc = "Search with FZF-Lua grep",
			},
			{
				"<leader>rG",
				function()
					require("fzf-lua").grep_last()
				end,
				desc = "Search with FZF-Lua grep (repeat)",
			},
			{
				"<leader>rb",
				function()
					require("fzf-lua").buffers()
				end,
				desc = "Search with FZF-Lua buffers",
			},
		},
	},
}
