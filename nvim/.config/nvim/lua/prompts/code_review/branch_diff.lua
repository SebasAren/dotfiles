-- Lua helper functions for branch comparison code review
-- This file provides functions to get diff between two branches

return {
	-- Default branch values
	base_branch = "main",
	target_branch = "HEAD",

	branch_diff = function(args)
		-- Get the git diff between the two branches
		local handle = io.popen("git diff " .. (args.base_branch or "main") .. ".." .. (args.target_branch or "HEAD"))
		local result = handle:read("*a")
		handle:close()

		return result
	end,

	branch_status = function(args)
		-- Get a summary of changes between branches
		local handle =
			io.popen("git log --oneline " .. (args.base_branch or "main") .. ".." .. (args.target_branch or "HEAD"))
		local result = handle:read("*a")
		handle:close()

		return result
	end,

	get_changed_files_between_branches = function(args)
		-- Get list of changed files between branches
		local handle =
			io.popen("git diff --name-only " .. (args.base_branch or "main") .. ".." .. (args.target_branch or "HEAD"))
		local result = handle:read("*a")
		handle:close()

		local files = {}
		for line in result:gmatch("[^\n]+") do
			if line and line ~= "" then
				table.insert(files, line)
			end
		end

		return table.concat(files, "\n")
	end,
}

