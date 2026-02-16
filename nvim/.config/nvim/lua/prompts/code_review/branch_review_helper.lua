-- Helper functions for branch review prompt
-- Collects user input for branches and triggers the code review prompt

local M = {}

function M.collect_branch_input()
	vim.ui.input({
		prompt = "Base branch (default: main): ",
	}, function(base_branch)
		if base_branch == nil then
			return
		end

		vim.ui.input({
			prompt = "Target branch (default: HEAD): ",
		}, function(target_branch)
			if target_branch == nil then
				return
			end

			local branch_diff = require("prompts.code_review.branch_diff")
			branch_diff.set_branches(
				base_branch ~= "" and base_branch or "main",
				target_branch ~= "" and target_branch or "HEAD"
			)

			require("codecompanion").prompt("review-branches")
		end)
	end)
end

return M