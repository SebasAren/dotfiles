local Worktree = require("git-worktree")

-- op = Operations.Switch, Operations.Create, Operations.Delete
-- metadata = table of useful values (structure dependent on op)
--      Switch
--          path = path you switched to
--          prev_path = previous worktree path
--      Create
--          path = path where worktree created
--          branch = branch name
--          upstream = upstream remote name
--      Delete
--          path = path where worktree deleted

Worktree.on_tree_change(function(op, metadata)
	if op == Worktree.Operations.Switch then
		local infile = io.open(metadata.prev_path .. "/../.env", "r")

		local outfile = io.open(metadata.path .. "/.env", "w")
		if outfile and infile then
			local instr = infile:read("*a")
			infile:close()
			outfile:write(instr)
			outfile:close()
		end
		print("Switched from " .. metadata.prev_path .. " to " .. metadata.path)
	end
end)
