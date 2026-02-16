-- Lua helper functions for branch comparison code review
-- This file provides functions to get diff between two branches
-- Used by branch_review.md markdown prompt via ${branch_diff.xxx} syntax

local M = {}

_G.__branch_review_state = _G.__branch_review_state or {
	base_branch = "main",
	target_branch = "HEAD",
}

function M.set_branches(base, target)
	_G.__branch_review_state.base_branch = base or "main"
	_G.__branch_review_state.target_branch = target or "HEAD"
	vim.notify(
		string.format("Branch review: %s..%s", _G.__branch_review_state.base_branch, _G.__branch_review_state.target_branch),
		vim.log.levels.INFO
	)
end

function M.base_branch(args)
	return _G.__branch_review_state.base_branch
end

function M.target_branch(args)
	return _G.__branch_review_state.target_branch
end

function M.branch_diff(args)
	local base = _G.__branch_review_state.base_branch
	local target = _G.__branch_review_state.target_branch
	local handle = io.popen("git diff " .. base .. ".." .. target .. " 2>&1")
	if not handle then
		return "Error: Failed to run git diff"
	end
	local result = handle:read("*a")
	handle:close()
	return result
end

function M.branch_status(args)
	local base = _G.__branch_review_state.base_branch
	local target = _G.__branch_review_state.target_branch
	local handle = io.popen("git log --oneline " .. base .. ".." .. target .. " 2>&1")
	if not handle then
		return "Error: Failed to run git log"
	end
	local result = handle:read("*a")
	handle:close()
	return result
end

function M.changed_files(args)
	local base = _G.__branch_review_state.base_branch
	local target = _G.__branch_review_state.target_branch
	local handle = io.popen("git diff --name-only " .. base .. ".." .. target .. " 2>&1")
	if not handle then
		return "Error: Failed to run git diff"
	end
	local result = handle:read("*a")
	handle:close()

	local files = {}
	for line in result:gmatch("[^\n]+") do
		if line and line ~= "" then
			table.insert(files, line)
		end
	end

	return table.concat(files, "\n")
end

return M

