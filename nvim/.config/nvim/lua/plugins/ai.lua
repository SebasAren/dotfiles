return {
	{
		"olimorris/codecompanion.nvim",
		opts = {},
		dependencies = {
			"nvim-lua/plenary.nvim",
			"nvim-treesitter/nvim-treesitter",
			"ravitemer/mcphub.nvim",
		},
		config = function()
			local default_model = "switchpoint/router"
			local available_models = {
				"baidu/ernie-4.5-300b-a47b",
				"qwen/qwen3-coder",
				"deepseek/deepseek-chat-v3-0324",
				"switchpoint/router",
			}
			local current_model = default_model

			local function select_model()
				vim.ui.select(available_models, {
					prompt = "Select  Model:",
				}, function(choice)
					if choice then
						current_model = choice
						vim.notify("Selected model: " .. current_model)
					end
				end)
			end

			require("codecompanion").setup({
				strategies = {
					chat = {
						adapter = "openrouter",
						keymaps = {
							submit = {
								modes = { n = "<CR>" },
								description = "Submit",
								callback = function(chat)
									chat:apply_model(current_model)
									chat:submit()
								end,
							},
						},
					},
					inline = {
						adapter = "openrouter",
					},
				},
				adapters = {
					openrouter = function()
						return require("codecompanion.adapters").extend("openai_compatible", {
							env = {
								url = "https://openrouter.ai/api",
								api_key = "OPENROUTER_API_KEY",
								chat_url = "/v1/chat/completions",
							},
							schema = {
								model = {
									default = current_model,
								},
							},
						})
					end,
				},
			})
			vim.keymap.set("n", "<leader>cs", select_model, { desc = "Select Model" })
		end,
	},
}
