-- Vitest Native MCP Server for mcphub.nvim
-- This server provides tools to execute vitest test suites

local M = {}

-- Helper function to check if vitest is available
local function check_vitest()
  local handle = io.popen('which vitest 2>/dev/null')
  local result = handle:read('*a')
  handle:close()
  return result and result ~= ''
end

-- Helper function to check if we're in a project with vitest
local function has_vitest_config()
  local config_files = { 'vitest.config.js', 'vitest.config.ts', 'vite.config.js', 'vite.config.ts' }
  for _, file in ipairs(config_files) do
    local f = io.open(file, 'r')
    if f then
      f:close()
      return true
    end
  end
  return false
end

-- Helper function to execute shell command and get output
local function execute_command(cmd, cwd)
  local full_cmd = cwd and string.format('cd %s && %s', cwd, cmd) or cmd
  local handle = io.popen(full_cmd .. ' 2>&1')
  local result = handle:read('*a')
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
          watch = {
            type = "boolean",
            description = "Run in watch mode",
            default = false
          },
          coverage = {
            type = "boolean",
            description = "Generate coverage report",
            default = false
          },
          update = {
            type = "boolean", 
            description = "Update snapshots",
            default = false
          }
        }
      },
      handler = function(req, res)
        if not check_vitest() then
          return res:error("Vitest is not installed. Please install with: npm install -D vitest")
        end
        
        if not has_vitest_config() then
          return res:error("No vitest configuration found. Please create vitest.config.js or vite.config.js")
        end

        local cwd = get_cwd()
        local cmd = "npx vitest run"
        
        if req.params.watch then
          cmd = "npx vitest --watch"
        end
        
        if req.params.coverage then
          cmd = cmd .. " --coverage"
        end
        
        if req.params.update then
          cmd = cmd .. " -u"
        end
        
        local success, output = execute_command(cmd, cwd)
        
        if success then
          return res:text(output):send()
        else
          return res:error("Test execution failed", { output = output })
        end
      end
    },
    {
      name = "run_test_file",
      description = "Run vitest tests for a specific file",
      inputSchema = {
        type = "object",
        properties = {
          file_path = {
            type = "string",
            description = "Path to the test file (relative or absolute)"
          },
          watch = {
            type = "boolean",
            description = "Run in watch mode",
            default = false
          },
          coverage = {
            type = "boolean",
            description = "Generate coverage report",
            default = false
          }
        },
        required = { "file_path" }
      },
      handler = function(req, res)
        if not check_vitest() then
          return res:error("Vitest is not installed. Please install with: npm install -D vitest")
        end
        
        local file_path = req.params.file_path
        if not vim.fn.filereadable(file_path) and not vim.fn.filereadable(file_path .. ".test.ts") then
          return res:error("Test file not found: " .. file_path)
        end

        local cwd = get_cwd()
        local cmd = string.format("npx vitest run %s", file_path)
        
        if req.params.watch then
          cmd = string.format("npx vitest --watch %s", file_path)
        end
        
        if req.params.coverage then
          cmd = cmd .. " --coverage"
        end
        
        local success, output = execute_command(cmd, cwd)
        
        if success then
          return res:text(output):send()
        else
          return res:error("Test execution failed", { output = output })
        end
      end
    },
    {
      name = "run_test_pattern",
      description = "Run vitest tests matching a pattern",
      inputSchema = {
        type = "object",
        properties = {
          pattern = {
            type = "string",
            description = "Test name pattern to match"
          },
          file_path = {
            type = "string",
            description = "Optional: restrict to specific file",
            default = ""
          },
          watch = {
            type = "boolean",
            description = "Run in watch mode",
            default = false
          }
        },
        required = { "pattern" }
      },
      handler = function(req, res)
        if not check_vitest() then
          return res:error("Vitest is not installed. Please install with: npm install -D vitest")
        end

        local pattern = req.params.pattern
        local cwd = get_cwd()
        local cmd = string.format("npx vitest run -t \"%s\"", pattern)
        
        if req.params.file_path and req.params.file_path ~= "" then
          cmd = cmd .. " " .. req.params.file_path
        end
        
        if req.params.watch then
          cmd = string.format("npx vitest --watch -t \"%s\"", pattern)
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
      end
    },
    {
      name = "get_test_status",
      description = "Get the current test status and summary",
      inputSchema = {
        type = "object",
        properties = {}
      },
      handler = function(req, res)
        if not check_vitest() then
          return res:error("Vitest is not installed")
        end

        local cwd = get_cwd()
        local success, output = execute_command("npx vitest --reporter=json --run", cwd)
        
        if success then
          -- Try to parse JSON output
          local json_start = output:find('{')
          if json_start then
            local json_str = output:sub(json_start)
            return res:text(json_str, "application/json"):send()
          else
            return res:text(output):send()
          end
        else
          return res:error("Failed to get test status", { output = output })
        end
      end
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
            default = ""
          }
        }
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
      end
    }
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
          local f = io.open(file, 'r')
          if f then
            local content = f:read('*a')
            f:close()
            found_config = { file = file, content = content }
            break
          end
        end
        
        if found_config then
          return res:text(string.format("Config file: %s\n\n%s", found_config.file, found_config.content), "application/javascript"):send()
        else
          return res:text("No vitest configuration found"):send()
        end
      end
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
          package_json_exists = vim.fn.filereadable("package.json") == 1
        }
        
        if info.package_json_exists then
          local f = io.open("package.json", 'r')
          if f then
            local content = f:read('*a')
            f:close()
            info.package_json = content
          end
        end
        
        return res:text(vim.inspect(info), "application/json"):send()
      end
    }
  }
}

return M

