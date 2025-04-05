return {
	{
		"kyazdani42/nvim-tree.lua",
		dependencies = {
			"kyazdani42/nvim-web-devicons", -- optional, for file icons
		},
	},
	{ "chentoast/marks.nvim" }, -- simpler mark navigation
	{ "natecraddock/workspaces.nvim" }, -- workspace support
	{
		"folke/trouble.nvim",
		dependencies = "kyazdani42/nvim-web-devicons",
		config = function()
			require("trouble").setup({})
		end,
	}, -- quickfix replacement
	{
		"AckslD/nvim-neoclip.lua",
		dependencies = {
			{ "kkharji/sqlite.lua", module = "sqlite" },
			{ "nvim-telescope/telescope.nvim" },
		},
		config = function()
			require("neoclip").setup()
		end,
	},
	{
		"lukas-reineke/indent-blankline.nvim",
		config = function()
			require("ibl").setup()
		end,
	}, -- indent lines
	{ "FooSoft/vim-argwrap" }, -- argument wrapper
	{
		"mrshmllow/document-color.nvim",
		config = function()
			require("document-color").setup({
				mode = "background",
			})
		end,
	},
	{ "mfussenegger/nvim-dap" },
	{
		"numToStr/Comment.nvim",
		config = function()
			require("Comment").setup()
		end,
	},
	{ "windwp/nvim-autopairs" }, -- automatically insert pairs
	{ "nvim-treesitter/nvim-treesitter", build = ":TSUpdate" }, -- syntax highlighting
	{
		"windwp/nvim-ts-autotag",
		config = function()
			require("nvim-ts-autotag").setup()
		end,
	},
	{ "ThePrimeagen/harpoon" },
	-- Testing
	{ "janko-m/vim-test" }, -- testing commands
	{ "akinsho/toggleterm.nvim", branch = "main" }, -- terminal wrapper
	-- Python
	{
		"linux-cultist/venv-selector.nvim",
		branch = "regexp",
		config = function()
			require("venv-selector").setup()
		end,
	},
	{ "Vimjas/vim-python-pep8-indent", ft = "python" }, -- python indenting
	{
		"iamcco/markdown-preview.nvim",
		build = function()
			vim.fn["mkdp#util#install"]()
		end,
		config = function()
			vim.g.mkdp_filetypes = { "markdown", "mkd" }
			vim.g.mkdp_command_for_global = 1
			vim.g.mkdp_echo_preview_url = 1
			vim.g.mkdp_auto_start = 0
			vim.g.mkdp_open_to_the_world = 1
		end,
	},
	{ "tpope/vim-surround" },
}
