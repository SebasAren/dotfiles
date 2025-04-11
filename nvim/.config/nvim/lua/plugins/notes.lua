return {
	{
		"zk-org/zk-nvim",
		config = function()
			require("zk").setup({
				picker = "fzf_lua",
				templates = {
					meeting = {
						title = "Meeting Notes - {date}",
						content = "# Meeting Notes\n\n## Attendees\n- \n\n## Agenda\n1. \n\n## Action Items\n- ",
					},
				},
				backlinks = {
					update_on_change = true, -- Auto-update backlinks when notes change
				},
			})
		end,
		keys = {
			-- Create a new note
			{
				"<leader>zn",
				function()
					require("zk.commands").get("ZkNew")({ dir = "notes" })
				end,
				desc = "Create a new note",
			},
			-- Open notes index
			{
				"<leader>zi",
				function()
					require("zk.commands").get("ZkIndex")()
				end,
				desc = "Open notes index",
			},
			-- Search notes
			{
				"<leader>zs",
				function()
					require("zk.commands").get("ZkNotes")()
				end,
				desc = "Search notes",
			},
			-- Insert link to a note
			{
				"<leader>zl",
				mode = { "n" },
				function()
					require("zk.commands").get("ZkInsertLink")()
				end,
				desc = "Insert link to a note",
			},
			{
				"<leader>zl",
				mode = { "x" },
				function()
					require("zk.commands").get("ZkInsertLinkAtSelection")()
				end,
				desc = "Insert link to a note at selection",
			},
			{
				"<leader>zt",
				function()
					require("zk.commands").get("ZkNewFromTemplate")({ dir = "notes", template = "meeting" })
				end,
				desc = "New meeting note",
			},
			{
				"<leader>zt",
				function()
					require("zk.commands").get("ZkTags")()
				end,
				desc = "Search notes by tags",
			},
			{
				"<leader>zd",
				function()
					local date = os.date("%Y-%m-%d")
					require("zk.commands").get("ZkNew")({ dir = "notes", title = "Daily - " .. date })
				end,
				desc = "Today's note",
			},
		},
	},
}
