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
				desc = "Fuzzy find files",
			},
			{
				"<leader>rg",
				function()
					require("fzf-lua").grep()
				end,
				desc = "Live grep in files",
			},
			{
				"<leader>rG",
				function()
					require("fzf-lua").grep_last()
				end,
				desc = "Repeat last grep search",
			},
			{
				"<leader>rb",
				function()
					require("fzf-lua").buffers()
				end,
				desc = "Search open buffers",
			},
		},
	},
}
