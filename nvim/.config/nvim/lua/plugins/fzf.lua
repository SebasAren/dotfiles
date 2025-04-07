return {
	{
		"ibhagwan/fzf-lua",
		dependencies = { "echasnovski/mini.icons" },
		opts = {},
		keys = {
			{
				"<leader>pp",
				function()
					require("fzf-lua").files()
				end,
				desc = "Fuzzy find files",
			},
			{
				"<leader>pg",
				function()
					require("fzf-lua").grep()
				end,
				desc = "Live grep in files",
			},
			{
				"<leader>pG",
				function()
					require("fzf-lua").grep_last()
				end,
				desc = "Repeat last grep search",
			},
			{
				"<leader>pb",
				function()
					require("fzf-lua").buffers()
				end,
				desc = "Search open buffers",
			},
			{
				"<leader>pd",
				function()
					require("fzf-lua").dap_commands()
				end,
			},
		},
	},
}
