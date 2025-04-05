return {
	{
		"janko-m/vim-test",
		config = function()
			vim.g["test#strategy"] = "neovim"
			vim.g["test#harpoon_term"] = 2
		end,
		keys = {
			{
				"<leader>tt",
				"<cmd>TestNearest<cr>",
				desc = "Start nearest test",
			},
			{
				"<leader>tT",
				"<cmd>TestFile<cr>",
				desc = "Start tests in file",
			},
			{
				"<leader>ta",
				"<cmd>TestSuite<cr>",
				desc = "Start full test suite",
			},
			{
				"<leader>tl",
				"<cmd>TestLast<cr>",
				desc = "Start last test",
			},
			{
				"<leader>tg",
				"<cmd>TestVisit<cr>",
				desc = "Start visit test",
			},
		},
	},
}
