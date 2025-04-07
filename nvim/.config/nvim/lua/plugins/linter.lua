return {
	"mfussenegger/nvim-lint",
	config = function()
		-- Configure linting tools for specific filetypes
		local lint = require("lint")
		lint.linters_by_ft = {
			-- JavaScript/TypeScript and related filetypes use eslint_d
			javascript = {
				"eslint_d",
			},
			typescript = {
				"eslint_d",
			},
			javascriptreact = {
				"eslint_d",
			},
			typescriptreact = {
				"eslint_d",
			},
			vue = {
				"eslint_d",
			},
			-- Python uses ruff for linting
			python = {
				"ruff",
			},
			-- Lua uses luacheck for linting
			lua = {
				"luacheck",
			},
			-- Dockerfiles use hadolint for linting
			dockerfile = {
				"hadolint",
			},
		}

		-- Set up autocmd to trigger linting on InsertLeave and BufWritePost events
		vim.api.nvim_create_autocmd({ "InsertLeave", "BufWritePost" }, {
			callback = function()
				-- Safely require and run linting
				local lint_status, lint = pcall(require, "lint")
				if lint_status then
					lint.try_lint()
				end
			end,
		})
	end,
}
