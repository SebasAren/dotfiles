-- Code review annotations — inlined from scristobal/code-review.nvim
-- Source: lua/review/init.lua

require("review").setup({
	keys = {
		add = false,
		delete = false,
		list = false,
		save = false,
		clear = false,
	},
})

return {
	{
		name = "code-review",
		keys = {
			{
				"<leader>ra",
				function()
					require("review").add()
				end,
				desc = "Add review comment",
				mode = { "n", "v" },
			},
			{
				"<leader>rd",
				function()
					require("review").delete()
				end,
				desc = "Delete review comment",
			},
			{
				"<leader>rl",
				function()
					require("review").list()
				end,
				desc = "List review comments",
			},
			{
				"<leader>rx",
				function()
					require("review").clear()
				end,
				desc = "Clear all review comments",
			},
		},
	},
}
