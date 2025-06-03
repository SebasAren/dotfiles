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
			"ravitemer/mcphub.nvim",
			{
				"MeanderingProgrammer/render-markdown.nvim",
				opts = { file_types = { "markdown", "Avante" } },
				ft = { "markdown", "Avante" },
			},
		},
		build = "make",
		opts = {
			provider = "openrouter_deepseek_v3",
			cursor_applying_provider = "groq",
			behaviour = {
				enable_cursor_planning_mode = true,
			},
			providers = {
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
				openrouter_deepseek_v3 = {
					__inherited_from = "openai",
					endpoint = "https://openrouter.ai/api/v1",
					api_key_name = "OPENROUTER_API_KEY",
					model = "deepseek/deepseek-chat-v3-0324",
				},
				openrouter_deepseek_r1 = {
					__inherited_from = "openai",
					endpoint = "https://openrouter.ai/api/v1",
					api_key_name = "OPENROUTER_API_KEY",
					model = "deepseek/deepseek-r1",
				},
				openrouter_gemini = {
					__inherited_from = "openai",
					endpoint = "https://openrouter.ai/api/v1",
					api_key_name = "OPENROUTER_API_KEY",
					model = "google/gemini-2.5-pro-preview-03-25",
				},
				perplexity = {
					__inherited_from = "openai",
					endpoint = "https://api.perplexity.ai",
					model = "sonar",
					api_key_name = "PERPLEXITY_API_KEY",
				},
			},
			system_prompt = function()
				local hub = require("mcphub").get_hub_instance()
				return hub:get_active_servers_prompt()
			end,
			disabled_tools = {
				"list_files",
				"search_files",
				"read_file",
				"create_file",
				"rename_file",
				"delete_file",
				"create_dir",
				"rename_dir",
				"delete_dir",
				"bash",
			},
			custom_tools = function()
				return { require("mcphub.extensions.avante").mcp_tool() }
			end,
		},
	},
	{
		"ravitemer/mcphub.nvim",
		dependencies = {
			"nvim-lua/plenary.nvim", -- Required for Job and HTTP requests
		},
		-- comment the following line to ensure hub will be ready at the earliest
		cmd = "MCPHub", -- lazy load by default
		-- uncomment this if you don't want mcp-hub to be available globally or can't use -g
		-- build = "npm install -g mcp-hub@latest",
		build = "bundled_build.lua", -- Use this and set use_bundled_binary = true in opts  (see Advanced configuration)
		config = function()
			require("mcphub").setup({
				auto_approve = true,
				extensions = {
					avante = {},
				},
				use_bundled_binary = true,
			})
		end,
	},
}
