-- Lua-based branch review prompt with proper user input collection
-- This follows CodeCompanion patterns for collecting structured user input

local function collect_branch_input(callback)
	-- Use vim.ui.input to collect base branch
	vim.ui.input({
		prompt = "Base branch (default: main): ",
	}, function(base_branch)
		if base_branch == nil then -- User cancelled
			return callback(nil)
		end

		-- Use vim.ui.input to collect target branch
		vim.ui.input({
			prompt = "Target branch (default: HEAD): ",
		}, function(target_branch)
			if target_branch == nil then -- User cancelled
				return callback(nil)
			end

			-- Return the collected values
			callback({
				base_branch = base_branch ~= "" and base_branch or "main",
				target_branch = target_branch ~= "" and target_branch or "HEAD",
			})
		end)
	end)
end

return {
	["Branch Code Review"] = {
		interaction = "chat",
		description = "Perform a comprehensive code review between two branches",
		opts = {
			alias = "review-branches",
			auto_submit = false,
		},
		-- Custom setup function to handle user input collection
		setup = function(self)
			collect_branch_input(function(branches)
				if not branches then
					return -- User cancelled
				end

				-- Store branches in the prompt instance for use in prompts
				self.branches = branches

				-- Trigger the prompt execution
				require("codecompanion").prompt(self.opts.alias, {
					context = {
						base_branch = branches.base_branch,
						target_branch = branches.target_branch,
					},
				})
			end)
		end,
		prompts = {
			{
				role = "system",
				content = "You are an expert senior software engineer specializing in code reviews. Your task is to analyze the differences between two git branches and provide a comprehensive code review. You should evaluate code quality, architecture decisions, potential bugs, performance implications, security concerns, and adherence to best practices.",
			},
			{
				role = "user",
				content = function(context)
					-- Load the branch diff helper functions
					local branch_diff = require("codecompanion.helpers.prompts").load_lua_file("branch_diff")

					local base_branch = context.base_branch or "main"
					local target_branch = context.target_branch or "HEAD"

					return string.format(
						[[
Please perform a comprehensive code review of the changes between the following branches:

Base branch: %s
Target branch: %s

Here's a summary of the changes:

```
%s
```

Here are the detailed changes between branches:

```diff
%s
```

Changed files:
```
%s
```

Please provide a detailed code review that includes:

1. **Overall Assessment**: Brief summary of the changes and their purpose
2. **Code Quality**: Evaluation of readability, maintainability, and consistency
3. **Architecture**: Assessment of design decisions and patterns used
4. **Potential Issues**: Any bugs, edge cases, or problematic code
5. **Performance**: Performance implications and optimizations
6. **Security**: Security concerns or vulnerabilities
7. **Best Practices**: Adherence to coding standards and conventions
8. **Suggestions**: Specific recommendations for improvement
9. **Rating**: Overall quality rating (Excellent/Good/Fair/Needs Work)

Be thorough but constructive, providing actionable feedback for each concern identified.
          ]],
						base_branch,
						target_branch,
						branch_diff.branch_status({ base_branch = base_branch, target_branch = target_branch }),
						branch_diff.branch_diff({ base_branch = base_branch, target_branch = target_branch }),
						branch_diff.get_changed_files_between_branches({
							base_branch = base_branch,
							target_branch = target_branch,
						})
					)
				end,
			},
		},
	},
}

