-- Vitest Native MCP Server for mcphub.nvim
-- This server provides tools to execute vitest test suites

local M = {}

-- Helper function to detect package manager and workspace structure
local function detect_package_manager()
	local cwd = vim.fn.getcwd()

	-- Check for common package manager lock files
	local lock_files = {
		yarn = "yarn.lock",
		pnpm = "pnpm-lock.yaml",
		npm = "package-lock.json",
		bun = "bun.lockb",
	}

	for manager, lockfile in pairs(lock_files) do
		if vim.fn.filereadable(lockfile) == 1 then
			return manager
		end
	end

	-- Check if package.json exists (default to npm)
	if vim.fn.filereadable("package.json") == 1 then
		return "npm"
	end

	return "npm" -- fallback
end

-- Helper function to check if we're in a yarn workspace
local function is_yarn_workspace()
  return vim.fn.filereadable("yarn.lock") == 1 and vim.fn.filereadable("package.json") == 1
end

-- Helper function to find yarn workspace packages
local function find_workspace_packages()
  local packages = {}
  
  if not is_yarn_workspace() then
    return packages
  end
  
  -- Read root package.json to find workspace configuration
  local f = io.open("package.json", "r")
  if f then
    local content = f:read("*a")
    f:close()
    
    -- Look for workspaces configuration
    local workspaces = content:match('"workspaces"%s*:%s*%[([^%]]+)%]')
    if workspaces then
      -- Extract workspace patterns
      for pattern in workspaces:gmatch('"([^"]+)"') do
        -- Find actual package directories matching the pattern
        local dirs = vim.fn.glob(pattern, false, true)
        for _, dir in ipairs(dirs) do
          local package_json = dir .. "/package.json"
          if vim.fn.filereadable(package_json) == 1 then
            local pkg_f = io.open(package_json, "r")
            if pkg_f then
              local pkg_content = pkg_f:read("*a")
              pkg_f:close()
              
              -- Extract package name
              local name = pkg_content:match('"name"%s*:%s*"([^"]+)"')
              if name then
                packages[name] = dir
              end
            end
          end
        end
      end
    end
  end
  
  return packages
end

-- Helper function to find vitest in monorepo structure
local function find_vitest_executable()
	local package_manager = detect_package_manager()

	-- Check if vitest is available globally first
	local handle = io.popen("which vitest 2>/dev/null")
	local global_vitest = handle:read("*a")
	handle:close()

	if global_vitest and global_vitest ~= "" then
		return "vitest" -- use global installation
	end

	-- Check node_modules/.bin for local installation
	local vitest_path = nil

	if vim.fn.isdirectory("node_modules/.bin") == 1 then
		-- Check if vitest exists in local node_modules
		if vim.fn.filereadable("node_modules/.bin/vitest") == 1 then
			vitest_path = "node_modules/.bin/vitest"
		elseif vim.fn.filereadable("node_modules/.bin/vitest.cmd") == 1 then
			vitest_path = "node_modules/.bin/vitest.cmd"
		end
	end

	-- Check parent directories for monorepos
	if not vitest_path then
		local dirs = vim.fn.split(vim.fn.getcwd(), "/")
		for i = #dirs, 1, -1 do
			local parent_path = table.concat(vim.fn.slice(dirs, 0, i), "/")
			local check_path = parent_path .. "/node_modules/.bin/vitest"

			if vim.fn.filereadable(check_path) == 1 then
				vitest_path = check_path
				break
			end
		end
	end

	-- Use package manager specific commands
	if not vitest_path then
		if package_manager == "yarn" then
			return "yarn vitest"
		elseif package_manager == "pnpm" then
			return "pnpm vitest"
		elseif package_manager == "bun" then
			return "bun vitest"
		else
			return "npx vitest"
		end
	end

	return vitest_path
end

-- Helper function to build workspace-specific command
local function build_workspace_command(workspace_name, cmd)
  if workspace_name and workspace_name ~= "" then
    return string.format("yarn workspace %s %s", workspace_name, cmd)
  else
    return cmd
  end
end

-- Helper function to check if we're in a project with vitest configuration
local function has_vitest_config(workspace_path)
	local config_files = { "vitest.config.js", "vitest.config.ts", "vite.config.js", "vite.config.ts" }
	
	-- If workspace path provided, check that directory
	local base_path = workspace_path and workspace_path or "."
	
	-- Check workspace-specific directory
	for _, file in ipairs(config_files) do
		local f = io.open(base_path .. "/" .. file, "r")
		if f then
			f:close()
			return true
		end
	end

	-- Check for vitest config in package.json
	if vim.fn.filereadable(base_path .. "/package.json") == 1 then
		local f = io.open(base_path .. "/package.json", "r")
		if f then
			local content = f:read("*a")
			f:close()
			-- Check if vitest is mentioned in scripts or devDependencies
			if content:match('"vitest"') or content:match('"test":.*vitest') then
				return true
			end
		end
	end

	return false
end

-- Helper function to check if vitest is available
local function check_vitest()
	local vitest_cmd = find_vitest_executable()

	-- Test vitest availability
	local handle = io.popen(vitest_cmd .. " --version 2>/dev/null")
	local result = handle:read("*a")
	handle:close()

	return result and result ~= ""
end

-- Helper function to execute shell command and get output
local function execute_command(cmd, cwd)
	local full_cmd = cwd and string.format("cd %s && %s", cwd, cmd) or cmd
	local handle = io.popen(full_cmd .. " 2>&1")
	local result = handle:read("*a")
	local success = handle:close()
	return success, result
end

-- Get current working directory from editor context
local function get_cwd()
	return vim.fn.getcwd()
end

M.name = "vitest"
M.displayName = "Vitest Test Runner"
M.capabilities = {
	tools = {
		{
			name = "run_all_tests",
			description = "Run all vitest tests in the current project",
			inputSchema = {
				type = "object",
				properties = {
					workspace = {
						type = "string",
						description = "Package name for yarn workspace (e.g., @tetra/bezorgen)",
						default = "",
					},
					watch = {
						type = "boolean",
						description = "Run in watch mode",
						default = false,
					},
					coverage = {
						type = "boolean",
						description = "Generate coverage report",
						default = false,
					},
					update = {
						type = "boolean",
						description = "Update snapshots",
						default = false,
					},
				},
			},
			handler = function(req, res)
				local workspace = req.params.workspace
				local cwd = get_cwd()
				local vitest_cmd
				
				if workspace and workspace ~= "" then
					-- Use yarn workspace command for specific package
					vitest_cmd = string.format("yarn workspace %s vitest", workspace)
					
					-- Check if workspace exists
					local packages = find_workspace_packages()
					if not packages[workspace] then
						return res:error("Workspace package not found: " .. workspace)
					end
				else
					if not check_vitest() then
						return res:error("Vitest is not installed. Please install with: npm install -D vitest")
					end

					if not has_vitest_config() then
						return res:error("No vitest configuration found. Please create vitest.config.js or vite.config.js")
					end
					
					vitest_cmd = find_vitest_executable()
				end
				
				local cmd = vitest_cmd .. " run"

				if req.params.watch then
					cmd = vitest_cmd .. " --watch"
				end

				if req.params.coverage then
					cmd = cmd .. " --coverage"
				end

				if req.params.update then
					cmd = cmd .. " -u"
				end

				local success, output
				if workspace and workspace ~= "" then
					-- Run from root directory for workspace
					success, output = execute_command(cmd, ".")
				else
					success, output = execute_command(cmd, cwd)
				end

				if success then
					return res:text(output):send()
				else
					return res:error("Test execution failed", { output = output })
				end
			end,
		},
		{
			name = "run_test_file",
			description = "Run vitest tests for a specific file",
			inputSchema = {
				type = "object",
				properties = {
					workspace = {
						type = "string",
						description = "Package name for yarn workspace (e.g., @tetra/bezorgen)",
						default = "",
					},
					file_path = {
						type = "string",
						description = "Path to the test file (relative or absolute)",
					},
					watch = {
						type = "boolean",
						description = "Run in watch mode",
						default = false,
					},
					coverage = {
						type = "boolean",
						description = "Generate coverage report",
						default = false,
					},
				},
				required = { "file_path" },
			},
			handler = function(req, res)
				local workspace = req.params.workspace
				local file_path = req.params.file_path
				
				if not vim.fn.filereadable(file_path) and not vim.fn.filereadable(file_path .. ".test.ts") then
					return res:error("Test file not found: " .. file_path)
				end

				local cwd = get_cwd()
				local vitest_cmd
				
				if workspace and workspace ~= "" then
					-- Use yarn workspace command for specific package
					vitest_cmd = string.format("yarn workspace %s vitest", workspace)
					
					-- Check if workspace exists
					local packages = find_workspace_packages()
					if not packages[workspace] then
						return res:error("Workspace package not found: " .. workspace)
					end
				else
					if not check_vitest() then
						return res:error("Vitest is not installed. Please install with: npm install -D vitest")
					end
					
					vitest_cmd = find_vitest_executable()
				end
				
				local cmd = string.format("%s run %s", vitest_cmd, file_path)

				if req.params.watch then
					cmd = string.format("%s --watch %s", vitest_cmd, file_path)
				end

				if req.params.coverage then
					cmd = cmd .. " --coverage"
				end

				local success, output
				if workspace and workspace ~= "" then
					-- Run from root directory for workspace
					success, output = execute_command(cmd, ".")
				else
					success, output = execute_command(cmd, cwd)
				end

				if success then
					return res:text(output):send()
				else
					return res:error("Test execution failed", { output = output })
				end
			end,
		},
		{
			name = "run_test_pattern",
			description = "Run vitest tests matching a pattern",
			inputSchema = {
				type = "object",
				properties = {
					pattern = {
						type = "string",
						description = "Test name pattern to match",
					},
					file_path = {
						type = "string",
						description = "Optional: restrict to specific file",
						default = "",
					},
					watch = {
						type = "boolean",
						description = "Run in watch mode",
						default = false,
					},
				},
				required = { "pattern" },
			},
			handler = function(req, res)
				if not check_vitest() then
					return res:error("Vitest is not installed. Please install with: npm install -D vitest")
				end

				local pattern = req.params.pattern
				local cwd = get_cwd()
				local vitest_cmd = find_vitest_executable()
				local cmd = string.format('%s run -t "%s"', vitest_cmd, pattern)

				if req.params.file_path and req.params.file_path ~= "" then
					cmd = cmd .. " " .. req.params.file_path
				end

				if req.params.watch then
					cmd = string.format('%s --watch -t "%s"', vitest_cmd, pattern)
					if req.params.file_path and req.params.file_path ~= "" then
						cmd = cmd .. " " .. req.params.file_path
					end
				end

				local success, output = execute_command(cmd, cwd)

				if success then
					return res:text(output):send()
				else
					return res:error("Test execution failed", { output = output })
				end
			end,
		},
		{
			name = "get_test_status",
			description = "Get the current test status and summary",
			inputSchema = {
				type = "object",
				properties = {},
			},
			handler = function(req, res)
				if not check_vitest() then
					return res:error("Vitest is not installed")
				end

				local cwd = get_cwd()
				local vitest_cmd = find_vitest_executable()
				local success, output = execute_command(vitest_cmd .. " --reporter=json --run", cwd)

				if success then
					-- Try to parse JSON output
					local json_start = output:find("{")
					if json_start then
						local json_str = output:sub(json_start)
						return res:text(json_str, "application/json"):send()
					else
						return res:text(output):send()
					end
				else
					return res:error("Failed to get test status", { output = output })
				end
			end,
		},
		{
			name = "list_test_files",
			description = "List all test files in the project",
			inputSchema = {
				type = "object",
				properties = {
					directory = {
						type = "string",
						description = "Directory to search for tests (default: current directory)",
						default = "",
					},
				},
			},
			handler = function(req, res)
				local directory = req.params.directory ~= "" and req.params.directory or vim.fn.getcwd()

				-- Find test files with common test patterns
				local test_patterns = { "*test*", "*spec*" }
				local test_extensions = { "js", "ts", "jsx", "tsx" }
				local test_files = {}

				for _, pattern in ipairs(test_patterns) do
					for _, ext in ipairs(test_extensions) do
						local files = vim.fn.glob(directory .. "/" .. pattern .. "." .. ext, false, true)
						for _, file in ipairs(files) do
							table.insert(test_files, file)
						end
					end
				end

				if #test_files > 0 then
					local result = "Found test files:\n\n"
					for _, file in ipairs(test_files) do
						result = result .. "- " .. file .. "\n"
					end
					return res:text(result):send()
				else
					return res:text("No test files found in " .. directory):send()
				end
			end,
		},
	},
	resources = {
		{
			name = "vitest_config",
			uri = "vitest://config",
			description = "Get current vitest configuration",
			handler = function(req, res)
				local config_files = { "vitest.config.js", "vitest.config.ts", "vite.config.js", "vite.config.ts" }
				local found_config = nil

				for _, file in ipairs(config_files) do
					local f = io.open(file, "r")
					if f then
						local content = f:read("*a")
						f:close()
						found_config = { file = file, content = content }
						break
					end
				end

				if found_config then
					return res:text(
						string.format("Config file: %s\n\n%s", found_config.file, found_config.content),
						"application/javascript"
					):send()
				else
					return res:text("No vitest configuration found"):send()
				end
			end,
		},
		{
			name = "current_project",
			uri = "vitest://project",
			description = "Get information about the current vitest project",
			handler = function(req, res)
				local cwd = get_cwd()
				local has_vitest = check_vitest()
				local has_config = has_vitest_config()

				local info = {
					current_directory = cwd,
					vitest_installed = has_vitest,
					vitest_configured = has_config,
					package_json_exists = vim.fn.filereadable("package.json") == 1,
				}

				if info.package_json_exists then
					local f = io.open("package.json", "r")
					if f then
						local content = f:read("*a")
						f:close()
						info.package_json = content
					end
				end

				return res:text(vim.inspect(info), "application/json"):send()
			end,
		},
	},
}

return M
