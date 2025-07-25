-- Conventional Commits Prompt Server for mcphub.nvim
-- Provides prompts and tools for creating conventional commit messages, staging files, and executing commits

local M = {}

-- Helper function to get all files with git status
local function get_git_status()
	local handle = io.popen("git status --porcelain 2>/dev/null")
	if not handle then
		return {}
	end

	local result = handle:read("*a")
	handle:close()

	if result == "" then
		return {}
	end

	local files = {}
	for line in result:gmatch("[^\r\n]+") do
		local status, file = line:match("(.)(%S+)")
		if status and file then
			table.insert(files, {
				status = status,
				filename = file,
				staged = (status == "A" or status == "M" or status == "D" or status == "R"),
				untracked = (status == "??"),
				modified = (status == "M" or status == " M"),
				deleted = (status == "D" or status == " D"),
				added = (status == "A" or status == " A"),
			})
		end
	end
	return files
end

-- Helper function to get staged files
local function get_staged_files()
	local handle = io.popen("git diff --staged --name-only 2>/dev/null")
	if not handle then
		return {}
	end

	local result = handle:read("*a")
	handle:close()

	if result == "" then
		return {}
	end

	local files = {}
	for line in result:gmatch("[^\r\n]+") do
		table.insert(files, line)
	end
	return files
end

-- Helper function to get unstaged files
local function get_unstaged_files()
	local handle = io.popen("git diff --name-only 2>/dev/null")
	if not handle then
		return {}
	end

	local result = handle:read("*a")
	handle:close()

	if result == "" then
		return {}
	end

	local files = {}
	for line in result:gmatch("[^\r\n]+") do
		table.insert(files, line)
	end
	return files
end

-- Helper function to get untracked files
local function get_untracked_files()
	local handle = io.popen("git ls-files --others --exclude-standard 2>/dev/null")
	if not handle then
		return {}
	end

	local result = handle:read("*a")
	handle:close()

	if result == "" then
		return {}
	end

	local files = {}
	for line in result:gmatch("[^\r\n]+") do
		table.insert(files, line)
	end
	return files
end

-- Helper function to get git diff of staged changes
local function get_staged_diff()
	local handle = io.popen("git diff --staged 2>/dev/null")
	if not handle then
		return ""
	end

	local result = handle:read("*a")
	handle:close()

	return result
end

-- Helper function to get git diff of unstaged changes
local function get_unstaged_diff()
	local handle = io.popen("git diff 2>/dev/null")
	if not handle then
		return ""
	end

	local result = handle:read("*a")
	handle:close()

	return result
end

-- Helper function to stage files
local function stage_files(files)
	if #files == 0 then
		return false, "No files to stage"
	end

	local cmd = "git add " .. table.concat(files, " ")
	local handle = io.popen(cmd .. " 2>&1")
	local result = handle:read("*a")
	local success = handle:close()

	return success, result
end

-- Helper function to commit changes
local function commit_changes(message)
	local cmd = string.format('git commit -m "%s"', message)
	local handle = io.popen(cmd .. " 2>&1")
	local result = handle:read("*a")
	local success = handle:close()

	return success, result
end

-- Helper function to detect the type of changes
local function detect_change_type(staged_files)
	local types = {}
	local has_feat = false
	local has_fix = false
	local has_docs = false
	local has_style = false
	local has_refactor = false
	local has_test = false
	local has_chore = false

	local file_patterns = {
		feat = { "src/", "lib/", "components/", "pages/", "app/" },
		fix = { "src/", "lib/", "components/", "pages/", "app/" },
		docs = { "README", "docs/", "*.md", "*.txt" },
		style = { "*.css", "*.scss", "*.sass", "*.less", "*.styl" },
		test = { "test/", "spec/", "*.test.", "*.spec." },
		chore = { "package.json", "*.config.js", "*.config.ts", "Makefile", "dockerfile" },
	}

	for _, file in ipairs(staged_files) do
		-- Check docs
		for _, pattern in ipairs(file_patterns.docs) do
			if file:match(pattern) then
				has_docs = true
				break
			end
		end

		-- Check style
		for _, pattern in ipairs(file_patterns.style) do
			if file:match(pattern) then
				has_style = true
				break
			end
		end

		-- Check test
		for _, pattern in ipairs(file_patterns.test) do
			if file:match(pattern) then
				has_test = true
				break
			end
		end

		-- Check chore
		for _, pattern in ipairs(file_patterns.chore) do
			if file:match(pattern) then
				has_chore = true
				break
			end
		end

		-- Check source files (default to feat/fix)
		if file:match("%.js$") or file:match("%.ts$") or file:match("%.py$") or file:match("%.go$") then
			-- Look for bug fix patterns in diff
			local diff = get_staged_diff()
			if diff:lower():match("fix") or diff:lower():match("bug") then
				has_fix = true
			else
				has_feat = true
			end
		end
	end

	-- Build suggested types based on detected files
	if has_feat then
		table.insert(types, "feat")
	end
	if has_fix then
		table.insert(types, "fix")
	end
	if has_docs then
		table.insert(types, "docs")
	end
	if has_style then
		table.insert(types, "style")
	end
	if has_refactor then
		table.insert(types, "refactor")
	end
	if has_test then
		table.insert(types, "test")
	end
	if has_chore then
		table.insert(types, "chore")
	end

	-- Default types if nothing detected
	if #types == 0 then
		return { "feat", "fix", "docs", "style", "refactor", "test", "chore", "perf", "ci", "build", "revert" }
	end

	return types
end

-- Helper function to check if we're in a git repository
local function is_git_repository()
	local handle = io.popen("git rev-parse --git-dir 2>/dev/null")
	if not handle then
		return false
	end

	local result = handle:read("*a")
	handle:close()

	return result and result ~= ""
end

M.name = "conventional-commits"
M.displayName = "Conventional Commits Helper"
M.capabilities = {
	tools = {
		{
			name = "stage_files",
			description = "Stage files for commit",
			inputSchema = {
				type = "object",
				properties = {
					files = {
						type = "array",
						items = { type = "string" },
						description = "Array of file paths to stage",
					},
					all = {
						type = "boolean",
						description = "Stage all modified files",
						default = false,
					},
				},
			},
			handler = function(req, res)
				if not is_git_repository() then
					return res:error("Not in a git repository")
				end

				local files_to_stage = {}

				if req.params.all then
					-- Stage all modified files
					local unstaged = get_unstaged_files()
					local untracked = get_untracked_files()

					for _, file in ipairs(unstaged) do
						table.insert(files_to_stage, file)
					end
					for _, file in ipairs(untracked) do
						table.insert(files_to_stage, file)
					end
				else
					files_to_stage = req.params.files or {}
				end

				if #files_to_stage == 0 then
					return res:text("No files to stage")
				end

				local success, output = stage_files(files_to_stage)

				if success then
					return res:text("Successfully staged " .. #files_to_stage .. " files"):send()
				else
					return res:error("Failed to stage files", { output = output })
				end
			end,
		},
		{
			name = "commit_changes",
			description = "Commit staged changes with a message",
			inputSchema = {
				type = "object",
				properties = {
					message = {
						type = "string",
						description = "Commit message",
					},
					amend = {
						type = "boolean",
						description = "Amend the last commit",
						default = false,
					},
				},
				required = { "message" },
			},
			handler = function(req, res)
				if not is_git_repository() then
					return res:error("Not in a git repository")
				end

				local staged_files = get_staged_files()
				if #staged_files == 0 then
					return res:error("No staged changes found")
				end

				local message = req.params.message
				local cmd = req.params.amend and 'git commit --amend -m "' .. message .. '"'
					or 'git commit -m "' .. message .. '"'

				local success, output = commit_changes(message)

				if success then
					return res:text("Successfully committed changes\n\n" .. output):send()
				else
					return res:error("Failed to commit", { output = output })
				end
			end,
		},
		{
			name = "get_status",
			description = "Get current git status including staged, unstaged, and untracked files",
			inputSchema = {
				type = "object",
				properties = {},
			},
			handler = function(req, res)
				if not is_git_repository() then
					return res:error("Not in a git repository")
				end

				local git_status = get_git_status()
				local staged = {}
				local unstaged = {}
				local untracked = {}

				for _, file in ipairs(git_status) do
					if file.staged then
						table.insert(staged, file.filename .. " (" .. file.status .. ")")
					elseif file.untracked then
						table.insert(untracked, file.filename)
					else
						table.insert(unstaged, file.filename .. " (" .. file.status .. ")")
					end
				end

				local result = "Git Status:\n\n"
				if #staged > 0 then
					result = result .. "📋 **Staged files:**\n"
					for _, f in ipairs(staged) do
						result = result .. "  - " .. f .. "\n"
					end
					result = result .. "\n"
				end

				if #unstaged > 0 then
					result = result .. "📝 **Unstaged files:**\n"
					for _, f in ipairs(unstaged) do
						result = result .. "  - " .. f .. "\n"
					end
					result = result .. "\n"
				end

				if #untracked > 0 then
					result = result .. "❓ **Untracked files:**\n"
					for _, f in ipairs(untracked) do
						result = result .. "  - " .. f .. "\n"
					end
					result = result .. "\n"
				end

				if #staged == 0 and #unstaged == 0 and #untracked == 0 then
					result = result .. "✅ Working directory clean"
				end

				return res:text(result):send()
			end,
		},
	},
	prompts = {
		{
			name = "create_commit",
			description = "Create, stage, and commit conventional commit messages",
			arguments = {
				{
					name = "type",
					description = "Commit type (feat, fix, docs, style, refactor, test, chore, perf, ci, build, revert)",
					type = "string",
					required = false,
				},
				{
					name = "scope",
					description = "Commit scope (e.g., auth, api, ui, config)",
					type = "string",
					required = false,
				},
				{
					name = "breaking",
					description = "Is this a breaking change?",
					type = "boolean",
					default = false,
				},
				{
					name = "body",
					description = "Additional details for the commit body",
					type = "string",
					required = false,
				},
				{
					name = "files",
					description = "Files to stage (empty for all modified/untracked)",
					type = "array",
					items = { type = "string" },
					required = false,
				},
				{
					name = "auto_stage",
					description = "Automatically stage files before committing",
					type = "boolean",
					default = true,
				},
				{
					name = "auto_commit",
					description = "Automatically commit after generating message",
					type = "boolean",
					default = false,
				},
			},
			handler = function(req, res)
				-- Check if we're in a git repository
				if not is_git_repository() then
					return res:user():text("❌ Not in a git repository"):send()
				end

				-- Get git status first
				local git_status = get_git_status()
				local staged_files = {}
				local unstaged_files = {}
				local untracked_files = {}

				for _, file in ipairs(git_status) do
					if file.staged then
						table.insert(staged_files, file.filename)
					elseif file.untracked then
						table.insert(untracked_files, file.filename)
					else
						table.insert(unstaged_files, file.filename)
					end
				end

				-- If specific files provided, stage them
				local files_to_stage = req.params.files or {}
				if #files_to_stage == 0 and req.params.auto_stage then
					-- Auto-stage modified and untracked files
					for _, file in ipairs(unstaged_files) do
						table.insert(files_to_stage, file)
					end
					for _, file in ipairs(untracked_files) do
						table.insert(files_to_stage, file)
					end
				end

				-- Stage files if requested
				local staging_result = ""
				if #files_to_stage > 0 then
					local success, stage_output = stage_files(files_to_stage)
					if success then
						staging_result = "📋 Staged " .. #files_to_stage .. " files\n"
						-- Refresh staged files after staging
						staged_files = get_staged_files()
					else
						return res:user():text("❌ Failed to stage files: " .. stage_output):send()
					end
				end

				-- Check if we have staged files now
				if #staged_files == 0 then
					return res:user()
						:text("❌ No staged changes found. Use the tools to stage files first or enable auto_stage.")
						:send()
				end

				-- Get git diff
				local staged_diff = get_staged_diff()

				-- Detect suggested commit types
				local suggested_types = detect_change_type(staged_files)

				-- Build context message
				local context_message = "Complete conventional commit workflow - including staging and commit\n\n"

				if staging_result ~= "" then
					context_message = context_message .. staging_result .. "\n"
				end

				context_message = context_message .. "📁 **Staged files:**\n"
				for _, f in ipairs(staged_files) do
					context_message = context_message .. "  - " .. f .. "\n"
				end
				context_message = context_message .. "\n"

				context_message = context_message .. "📊 **Suggested commit types:**\n"
				for _, t in ipairs(suggested_types) do
					context_message = context_message .. "  - " .. t .. "\n"
				end
				context_message = context_message .. "\n"

				if staged_diff ~= "" then
					context_message = context_message .. "📝 **Changes summary:**\n"
					context_message = context_message .. "```diff\n"
					context_message = context_message
						.. staged_diff:sub(1, 1000)
						.. (staged_diff:len() > 1000 and "..." or "")
					context_message = context_message .. "\n```\n\n"
				end

				-- Add user-provided parameters
				local extra_info = {}
				if req.params.type and req.params.type ~= "" then
					table.insert(extra_info, "- User requested type: " .. req.params.type)
				end
				if req.params.scope and req.params.scope ~= "" then
					table.insert(extra_info, "- User requested scope: " .. req.params.scope)
				end
				if req.params.breaking then
					table.insert(extra_info, "- Breaking change requested: Yes")
				end
				if req.params.body and req.params.body ~= "" then
					table.insert(extra_info, "- Additional context: " .. req.params.body)
				end

				if #extra_info > 0 then
					context_message = context_message .. "**Considerations:**\n"
					for _, info in ipairs(extra_info) do
						context_message = context_message .. info .. "\n"
					end
					context_message = context_message .. "\n"
				end

				local auto_stage_info = req.params.auto_stage and "Auto-staging is enabled"
					or "Files are already staged"
				local auto_commit_info = req.params.auto_commit and "Auto-commit is enabled"
					or "Manual confirmation required"

				context_message = context_message
					.. "**Workflow:** "
					.. auto_stage_info
					.. ". "
					.. auto_commit_info
					.. "\n\n"

				context_message = context_message
					.. "Based on the staged changes, please suggest a conventional commit message following these guidelines:\n\n"
				context_message = context_message .. "**Format:** `type(scope): description`\n\n"
				context_message = context_message .. "**Types:**\n"
				context_message = context_message .. "- `feat`: A new feature\n"
				context_message = context_message .. "- `fix`: A bug fix\n"
				context_message = context_message .. "- `docs`: Documentation only changes\n"
				context_message = context_message .. "- `style`: Changes that do not affect the meaning of the code\n"
				context_message = context_message
					.. "- `refactor`: A code change that neither fixes a bug nor adds a feature\n"
				context_message = context_message .. "- `perf`: A code change that improves performance\n"
				context_message = context_message .. "- `test`: Adding missing tests or correcting existing tests\n"
				context_message = context_message .. "- `chore`: Changes to the build process or auxiliary tools\n"
				context_message = context_message .. "- `ci`: Changes to CI configuration files and scripts\n"
				context_message = context_message
					.. "- `build`: Changes that affect the build system or external dependencies\n"
				context_message = context_message .. "- `revert`: Reverts a previous commit\n\n"
				context_message = context_message
					.. "**Breaking changes:** Add `!` after type/scope (e.g., `feat(api)!: change endpoint`)\n\n"
				context_message = context_message .. "**After generating the commit message, you can:**\n"
				context_message = context_message
					.. "1. Use the `commit_changes` tool to commit with the suggested message\n"
				context_message = context_message .. "2. Provide a different message if needed\n"
				context_message = context_message .. "3. Make changes to the staged files first\n\n"

				if req.params.auto_commit then
					context_message = context_message
						.. "**AUTO-COMMIT ENABLED:** After providing the commit message, it will be automatically committed."
				else
					context_message = context_message
						.. "**MANUAL CONFIRMATION:** After providing the commit message, you can review and decide whether to commit."
				end

				return res:user()
					:text(context_message)
					:llm()
					:text("I'll analyze the staged changes and provide a conventional commit message.")
					:text("")
					:text("Here's the suggested conventional commit message:")
					:send()
			end,
		},
		{
			name = "interactive_commit",
			description = "Interactive commit workflow with file selection and staging",
			arguments = {
				{
					name = "confirm_commit",
					description = "Commit immediately after generating message",
					type = "boolean",
					default = false,
				},
			},
			handler = function(req, res)
				-- Check if we're in a git repository
				if not is_git_repository() then
					return res:user():text("❌ Not in a git repository"):send()
				end

				-- Get git status
				local git_status = get_git_status()
				local staged_files = {}
				local unstaged_files = {}
				local untracked_files = {}

				for _, file in ipairs(git_status) do
					if file.staged then
						table.insert(staged_files, file.filename)
					elseif file.untracked then
						table.insert(untracked_files, file.filename)
					else
						table.insert(unstaged_files, file.filename)
					end
				end

				-- Build interactive prompt
				local interactive_message = "Interactive conventional commit workflow\n\n"

				interactive_message = interactive_message .. "📊 **Current status:**\n"
				interactive_message = interactive_message .. "- Staged: " .. #staged_files .. " files\n"
				interactive_message = interactive_message .. "- Unstaged: " .. #unstaged_files .. " files\n"
				interactive_message = interactive_message .. "- Untracked: " .. #untracked_files .. " files\n\n"

				if #unstaged_files > 0 then
					interactive_message = interactive_message .. "📝 **Unstaged files to consider:**\n"
					for _, file in ipairs(unstaged_files) do
						interactive_message = interactive_message .. "  - " .. file .. "\n"
					end
					interactive_message = interactive_message .. "\n"
				end

				if #untracked_files > 0 then
					interactive_message = interactive_message .. "❓ **Untracked files to consider:**\n"
					for _, file in ipairs(untracked_files) do
						interactive_message = interactive_message .. "  - " .. file .. "\n"
					end
					interactive_message = interactive_message .. "\n"
				end

				interactive_message = interactive_message .. "🔧 **Available tools:**\n"
				interactive_message = interactive_message .. "- `get_status`: Check current git status\n"
				interactive_message = interactive_message .. "- `stage_files`: Stage specific files or all changes\n"
				interactive_message = interactive_message .. "- `commit_changes`: Commit with conventional message\n\n"

				interactive_message = interactive_message .. "**Workflow steps:**\n"
				interactive_message = interactive_message .. "1. Use `stage_files` to stage desired files\n"
				interactive_message = interactive_message .. "2. Use `create_commit` to generate commit message\n"
				interactive_message = interactive_message .. "3. Use `commit_changes` to execute the commit\n\n"

				interactive_message = interactive_message .. "Which files would you like to stage and commit?"

				return res:user()
					:text(interactive_message)
					:text("")
					:text("**Example workflow:**")
					:text('1. Call: stage_files with {"all": true}')
					:text("2. Call: create_commit to generate message")
					:text("3. Call: commit_changes with the generated message")
					:send()
			end,
		},
	},
}

return M
