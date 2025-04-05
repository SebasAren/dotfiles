return {
	{
		"catppuccin/nvim",
		name = "catppuccin",
		config = function()
			vim.g.catppuccin_flavour = "mocha"
			require("catppuccin").setup()
			vim.cmd([[colorscheme catppuccin]])
		end,
	}, -- material colourscheme
	{ "ryanoasis/vim-devicons" }, -- icons for plugins
	{ "adelarsq/vim-devicons-emoji" }, -- more icons for plugins
}
