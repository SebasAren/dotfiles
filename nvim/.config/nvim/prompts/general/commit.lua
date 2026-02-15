-- Lua helper functions for commit prompt
-- This file provides the diff function used in commit.md

return {
	diff = function(args)
		-- Get the git diff for ALL changes (staged and unstaged)
		local handle = io.popen("git diff")
		local result = handle:read("*a")
		handle:close()

		-- If no unstaged changes, check staged changes
		if result == "" then
			local handle = io.popen("git diff --cached")
			result = handle:read("*a")
			handle:close()
		end

		return result
	end,

	status = function(args)
		-- Get the git status for ALL changes
		local handle = io.popen("git status --short")
		local result = handle:read("*a")
		handle:close()
		return result
	end,

	get_changed_files_formatted = function(args)
		-- Get a formatted list of ALL changed files (staged and unstaged)
		local handle = io.popen("git status --short")
		local result = handle:read("*a")
		handle:close()

		local files = {}
		for line in result:gmatch("[^\n]+") do
			-- Extract filename from git status line (e.g., " M file.txt" -> "file.txt")
			local filename = line:match("^..%s+(.+)")
			if filename then
				table.insert(files, filename)
			end
		end

		return table.concat(files, "\n")
	end,
}

