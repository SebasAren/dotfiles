return {
	-- Common plugins
	{ "chrisbra/Colorizer" }, -- adds color highlighting to certain filetypes
	{ "ggandor/lightspeed.nvim" }, -- s navigation
	{
		"rebelot/heirline.nvim",
		config = function()
			require("heirline").setup(require("config.statusline.main"))
		end,
	},
	{ "rhysd/vim-grammarous" }, -- grammar check
	{ "andymass/vim-matchup" }, -- matching parens and more
}
