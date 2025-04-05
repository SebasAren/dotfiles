return {
	{
		"kyazdani42/nvim-tree.lua",
		dependencies = {
			"kyazdani42/nvim-web-devicons", -- optional, for file icons
		},
		opts = {
			diagnostics = {
				enable = false,
			},
		},
		keys = {
			{
				"<leader>nn",
				"<cmd>NvimTreeToggle<cr>",
				desc = "Open NvimTree",
			},
			{
				"<leader>nc",
				"<cmd>NvimTreeFindFile<cr>",
				desc = "Open NvimTree on current file",
			},
			{
				"<leader>nb",
				"<cmd>NvimTreeCollapseKeepBuffers<cr>",
				desc = "Open NvimTree and collapse tree",
			},
		},
	},
}
