return {
	{
		"yetone/avante.nvim",
		event = "VeryLazy",
		version = false,
		dependencies = {
			"nvim-treesitter/nvim-treesitter",
			"stevearc/dressing.nvim",
			"nvim-lua/plenary.nvim",
			"MunifTanjim/nui.nvim",
			{
				"MeanderingProgrammer/render-markdown.nvim",
				opts = { file_types = { "markdown", "Avante" } },
				ft = { "markdown", "Avante" },
			},
		},
		build = "make",
		opts = {
			provider = "openrouter_deepseek",
			cursor_applying_provider = "groq",
			behaviour = {
				enable_cursor_planning_mode = true,
			},
			vendors = {
				openrouter_claude = {
					__inherited_from = "openai",
					endpoint = "https://openrouter.ai/api/v1",
					api_key_name = "OPENROUTER_API_KEY",
					model = "anthropic/claude-3.7-sonnet",
				},
				openrouter_chatgpt = {
					__inherited_from = "openai",
					endpoint = "https://openrouter.ai/api/v1",
					api_key_name = "OPENROUTER_API_KEY",
					model = "openai/gpt-4o-mini",
				},
				groq = {
					__inherited_from = "openai",
					api_key_name = "GROQ_API_KEY",
					endpoint = "https://api.groq.com/openai/v1/",
					model = "llama-3.3-70b-versatile",
					max_tokens = 32768,
				},
				openrouter_deepseek = {
					__inherited_from = "openai",
					endpoint = "https://openrouter.ai/api/v1",
					api_key_name = "OPENROUTER_API_KEY",
					model = "deepseek/deepseek-chat-v3-0324",
				},
			},
		},
	},
	{
		"olimorris/codecompanion.nvim",
		dependencies = {
			"nvim-lua/plenary.nvim",
			"nvim-treesitter/nvim-treesitter",
		},
		opts = {
			adapters = {
				openrouter_deepseek = function()
					return require("codecompanion.adapters").extend("openai_compatible", {
						env = {
							url = "https://openrouter.ai/api",
							api_key = "OPENROUTER_API_KEY",
							chat_url = "/v1/chat/completions",
						},
						schema = {
							model = {
								default = "deepseek/deepseek-chat-v3-0324",
							},
						},
					})
				end,
			},
			strategies = {
				chat = {
					adapter = "openrouter_deepseek",
				},
				inline = {
					adapter = "openrouter_deepseek",
				},
			},
			display = {
				diff = {
					enabled = true,
					close_chat_at = 240,
					layout = "vertical",
					opts = { "internal", "filler", "closeoff", "algorithm:patience", "followwrap", "linematch:120" },
					provider = "mini_diff", -- default|mini_diff
				},
			},
		},
	},
}
