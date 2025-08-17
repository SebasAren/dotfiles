return {
	{
		"frankroeder/parrot.nvim",
		dependencies = { "ibhagwan/fzf-lua", "nvim-lua/plenary.nvim" },
		-- optionally include "folke/noice.nvim" or "rcarriga/nvim-notify" for beautiful notifications
		config = function()
			require("parrot").setup({
				-- Providers must be explicitly set up to make them available.
				providers = {
					zai = {
						name = "zai",
						api_key = os.getenv("ZAI_API_KEY"),
						endpoint = "https://api.z.ai/api/paas/v4/chat/completions",
						model_endpoint = "https://api.z.ai/api/paas/v4/models",
						topic = {
							model = "glm-4.5",
						},
						models = {
							"glm-4.5",
							"glm-4.5-air",
						},
					},
				},
				prompts = {
					["Debug"] = "I want you to provide the provided snippet with comprehensive debug statements.",
				},
			})
		end,
	},
}
