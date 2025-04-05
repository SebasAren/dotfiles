return {
	{
		"catppuccin/nvim",
		name = "catppuccin",
		priority = 1000,
		config = function()
			vim.cmd.colorscheme("catppuccin-mocha")
		end,
	},
	{ "ryanoasis/vim-devicons" }, -- icons for plugins
	{ "adelarsq/vim-devicons-emoji" }, -- more icons for plugins
}
