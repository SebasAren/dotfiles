return {
	{
		"ibhagwan/fzf-lua",
		dependencies = { "echasnovski/mini.icons" },
		opts = {},
		keys = {
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
		},
	},
}
