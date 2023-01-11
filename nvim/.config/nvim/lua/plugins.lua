return require("packer").startup({
	function(use)
		use("wbthomason/packer.nvim")

		-- common
		use("chrisbra/Colorizer") -- adds color highlighting to certain filetypes
		use("ggandor/lightspeed.nvim") -- s navigation
		use("nvim-lualine/lualine.nvim") -- statusline
		use({ "echasnovski/mini.nvim", branch = "main" }) -- utility functions
		use("rhysd/vim-grammarous") -- grammar check
		use("andymass/vim-matchup") -- matching parens and more
		use("mhartington/formatter.nvim") -- formatting
		use("tpope/vim-surround")
		use({
			"catppuccin/nvim",
			as = "catppuccin",
			config = function()
				vim.g.catppuccin_flavour = "mocha"
				require("catppuccin").setup()
				vim.cmd([[colorscheme catppuccin]])
			end,
		}) -- material colourscheme
		use("ryanoasis/vim-devicons") -- icons for plugins
		use("adelarsq/vim-devicons-emoji") -- more icons for plugins
		use("lukas-reineke/indent-blankline.nvim") -- indent lines
		use({
			"romgrk/barbar.nvim",
			requires = { "kyazdani42/nvim-web-devicons" },
		}) -- tab bar on top of screen and easy mappings
		use({
			"kyazdani42/nvim-tree.lua",
			requires = {
				"kyazdani42/nvim-web-devicons", -- optional, for file icons
			},
			tag = "nightly", -- optional, updated every week. (see issue #1193)
		})
		use("chentoast/marks.nvim") -- simpler mark navigation
		use("FooSoft/vim-argwrap") -- argument wrapper
		use("natecraddock/workspaces.nvim") -- workspace support
		use({
			"folke/trouble.nvim",
			requires = "kyazdani42/nvim-web-devicons",
			config = function()
				require("trouble").setup({})
			end,
		}) -- quickfix replacement
		use({
			"AckslD/nvim-neoclip.lua",
			requires = {
				{ "kkharji/sqlite.lua", module = "sqlite" },
				{ "nvim-telescope/telescope.nvim" },
			},
			config = function()
				require("neoclip").setup()
			end,
		})

		-- git
		use("rhysd/git-messenger.vim") -- see latest commit of line
		use({
			"tanvirtin/vgit.nvim", -- easy staging from within buffer
			requires = {
				"nvim-lua/plenary.nvim",
			},
		})
		use({
			"ThePrimeagen/git-worktree.nvim",
			config = function()
				require("git-worktree").setup({})
			end,
		})

		-- general dev
		use({
			"williamboman/mason.nvim",
			"williamboman/mason-lspconfig.nvim",
			"neovim/nvim-lspconfig",
		})
		use({ "b0o/schemastore.nvim" })
		use({
			"mrshmllow/document-color.nvim",
			config = function()
				require("document-color").setup({
					mode = "background",
				})
			end,
		})
		-- autocompletion
		use({
			"hrsh7th/cmp-nvim-lsp",
			"hrsh7th/cmp-buffer",
			"hrsh7th/cmp-path",
			"hrsh7th/cmp-cmdline",
			"hrsh7th/nvim-cmp",
			"hrsh7th/cmp-vsnip",
			"hrsh7th/vim-vsnip",
			"hrsh7th/vim-vsnip-integ",
			"rafamadriz/friendly-snippets",
			"hrsh7th/cmp-nvim-lsp-signature-help",
			"hrsh7th/cmp-nvim-lsp-document-symbol",
			"hrsh7th/cmp-nvim-lua",
		})
		use("mfussenegger/nvim-dap")
		use({
			"glepnir/lspsaga.nvim",
			branch = "main",
			config = function()
				require("lspsaga").init_lsp_saga()
			end,
		})
		use({
			"numToStr/Comment.nvim",
			config = function()
				require("Comment").setup()
			end,
		})
		use("gfanto/fzf-lsp.nvim")
		use("windwp/nvim-autopairs") -- automatically insert pairs
		use({ "nvim-treesitter/nvim-treesitter", run = ":TSUpdate" }) -- syntax highlighting
		use({
			"windwp/nvim-ts-autotag",
			config = function()
				require("nvim-ts-autotag").setup()
			end,
		})

		-- search
		use({ "nvim-telescope/telescope.nvim", requires = { { "nvim-lua/popup.nvim" }, { "nvim-lua/plenary.nvim" } } }) -- file finder
		use({
			"nvim-telescope/telescope-fzf-native.nvim",
			run = "cmake -S. -Bbuild -DCMAKE_BUILD_TYPE=Release && cmake --build build --config Release && cmake --install build --prefix build",
		})
		use({ "ThePrimeagen/harpoon" })

		-- testing
		use("janko-m/vim-test") -- testing commands
		use({ "akinsho/toggleterm.nvim", branch = "main" }) -- terminal wrapper

		-- python
		use({ "Vimjas/vim-python-pep8-indent", ft = "python" }) -- python indenting

		-- neorg
		use({
			"nvim-neorg/neorg",
			config = function()
				require("neorg").setup({
					load = {
						["core.defaults"] = {},
						["core.norg.dirman"] = {
							config = { workspaces = { work = "~/notes/work", home = "~/notes/home" } },
						},
						["core.norg.completion"] = { config = { engine = "nvim-cmp" } },
					},
				})
			end,
			requires = "nvim-lua/plenary.nvim",
		})
	end,
})
