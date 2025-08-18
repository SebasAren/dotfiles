local provider_setup, providers = pcall(function()
	return require("plugins.llms.parrot")
end)

return {
	{
		"frankroeder/parrot.nvim",
		dependencies = { "ibhagwan/fzf-lua", "nvim-lua/plenary.nvim" },
		-- optionally include "folke/noice.nvim" or "rcarriga/nvim-notify" for beautiful notifications
		config = function()
			require("parrot").setup({
				-- Providers must be explicitly set up to make them available.
				providers = provider_setup and providers or {},
				prompts = {
					["Debug"] = "I want you to provide the provided snippet with comprehensive debug statements.",
				},
			})
		end,
	},
}
