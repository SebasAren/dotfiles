return {
	"nvim-tree/nvim-tree.lua",
	version = "*",
	lazy = false,
	config = function()
		require("nvim-tree").setup({})
	end,
	keys = {
		{
			"<leader>nt",
			function()
				require("nvim-tree.api").tree.toggle()
			end,
			desc = "Toggle nvim tree",
		},
	},
}
