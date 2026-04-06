return {
	{
		"ibhagwan/fzf-lua",
		dependencies = { "echasnovski/mini.nvim" },
		opts = {
			previewers = {
				git_diff = {
					pager = "delta",
				},
			},
			git = {
				status = {
					actions = {
						["enter"] = function(selected)
							require("fzf-lua.actions").file_edit(selected)
						end,
						["ctrl-s"] = function(selected)
							require("fzf-lua.actions").git_stage(selected)
						end,
						["ctrl-u"] = function(selected)
							require("fzf-lua.actions").git_unstage(selected)
						end,
					},
				},
			},
		},
		keys = {
			-- Git code review pickers
			{
				"<leader>gs",
				function()
					require("fzf-lua").git_status()
				end,
				desc = "Git status",
			},
			{
				"<leader>gD",
				function()
					require("fzf-lua").git_diff({ ref = "main" })
				end,
				desc = "Git diff vs main",
			},
			{
				"<leader>gj",
				function()
					require("fzf-lua").git_hunks()
				end,
				desc = "Git hunks (next/prev changes)",
			},
			{
				"<leader>gc",
				function()
					require("fzf-lua").git_commits()
				end,
				desc = "Git commits",
			},
			{
				"<leader>gC",
				function()
					require("fzf-lua").git_bcommits()
				end,
				desc = "Buffer git commits",
			},
			{
				"<leader>gS",
				function()
					require("fzf-lua").git_stash()
				end,
				desc = "Git stash",
			},

			-- General pickers
			{
				"<leader>pp",
				function()
					require("fzf-lua").files()
				end,
				desc = "Fuzzy find files",
			},
			{
				"<leader>pg",
				function()
					require("fzf-lua").grep()
				end,
				desc = "Live grep in files",
			},
			{
				"<leader>pG",
				function()
					require("fzf-lua").grep_last()
				end,
				desc = "Repeat last grep search",
			},
			{
				"<leader>pb",
				function()
					require("fzf-lua").buffers()
				end,
				desc = "Search open buffers",
			},
			{
				"<leader>pc",
				function()
					require("fzf-lua").commands()
				end,
				desc = "Search Neovim commands",
			},
			{
				"<leader>pf",
				function()
					require("fzf-lua").git_files()
				end,
				desc = "Search git files",
			},
			{
				"<leader>pt",
				function()
					require("fzf-lua").tags()
				end,
				desc = "Search tags",
			},
			{
				"<leader>ps",
				function()
					require("fzf-lua").lsp_document_symbols()
				end,
				desc = "Search document symbols",
			},
			{
				"<leader>pS",
				function()
					require("fzf-lua").lsp_workspace_symbols()
				end,
				desc = "Search workspace symbols",
			},
			{
				"<leader>pD",
				function()
					require("fzf-lua").diagnostics_workspace()
				end,
				desc = "Search workspace diagnostics",
			},
			{
				"<leader>ph",
				function()
					require("fzf-lua").help_tags()
				end,
				desc = "Search help tags",
			},
			{
				"<leader>pm",
				function()
					require("fzf-lua").marks()
				end,
				desc = "Search marks",
			},
			{
				"<leader>pl",
				function()
					require("fzf-lua").blines()
				end,
				desc = "Search lines in current buffer",
			},
			{
				"<leader>pL",
				function()
					require("fzf-lua").lines()
				end,
				desc = "Search lines in all buffers",
			},
			{
				"<leader>pr",
				function()
					require("fzf-lua").resume()
				end,
				desc = "Resume last fzf-lua session",
			},
			{
				"<leader>pd",
				function()
					require("fzf-lua").dap_commands()
				end,
				desc = "Search DAP commands with fzf",
			},
			{
				"<leader>gh",
				function()
					require("fzf-lua").lsp_definitions()
				end,
				desc = "Search LSP Definitions",
			},
			{
				"<leader>ga",
				function()
					require("fzf-lua").lsp_code_actions()
				end,
				desc = "Search LSP Code Actions",
			},
			{
				"<leader>gr",
				function()
					require("fzf-lua").lsp_references()
				end,
				desc = "Search LSP references",
			},
			{
				"<leader>pgd",
				function()
					require("fzf-lua").git_diff()
				end,
				desc = "Search git diff",
			},
			{
				"<leader>gB",
				function()
					local ref = vim.env.WPI_BASE_BRANCH
					if ref and ref ~= "" then
						require("fzf-lua").git_diff({ ref = ref })
					else
						vim.notify("WPI_BASE_BRANCH not set", vim.log.levels.WARN)
					end
				end,
				desc = "Git diff vs wpi base branch",
			},
		},
	},
}
