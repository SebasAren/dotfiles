return {
	{
		"scristobal/code-review.nvim",
		opts = {},
		keys = {
			{ "<leader>ra", function() require("code-review").add_comment() end, desc = "Add review comment", mode = { "n", "v" } },
			{ "<leader>rd", function() require("code-review").delete_comment() end, desc = "Delete review comment" },
			{ "<leader>rl", function() require("code-review").list_comments() end, desc = "List review comments" },
			{ "<leader>rs", function() require("code-review").save() end, desc = "Save review comments to .code-review.md" },
			{ "<leader>rx", function() require("code-review").clear() end, desc = "Clear all review comments" },
		},
	},
}
