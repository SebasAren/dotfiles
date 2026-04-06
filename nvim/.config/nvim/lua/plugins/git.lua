return {
	{
		"lewis6991/gitsigns.nvim",
		lazy = false,
		opts = function()
			local opts = {
				current_line_blame = true,
				signs = {
					add = { text = "+" },
					change = { text = "~" },
					delete = { text = "_" },
					topdelete = { text = "‾" },
					changedelete = { text = "~" },
				},
			}
			-- When launched from wpi review step, diff against the source branch
			-- so gutter signs show all changes pi made (not just uncommitted ones).
			if vim.env.WPI_BASE_BRANCH then
				opts.base = vim.env.WPI_BASE_BRANCH
				opts.on_attach = function(bufnr)
					local gs = require("gitsigns")

					local function map(mode, lhs, rhs, desc)
						vim.keymap.set(mode, lhs, rhs, { buffer = bufnr, desc = desc })
					end

					-- Side-by-side diff of current file vs base branch
					map("n", "<leader>gd", function()
						gs.diffthis(vim.env.WPI_BASE_BRANCH)
					end, "Diff file vs wpi base")

					-- Navigate between changed hunks
					map("n", "]h", function()
						gs.nav_hunk("next")
					end, "Next hunk")
					map("n", "[h", function()
						gs.nav_hunk("prev")
					end, "Prev hunk")
				end
			end
			return opts
		end,
	},
	{
		"akinsho/git-conflict.nvim",
		version = "*",
		config = true,
	},
}
