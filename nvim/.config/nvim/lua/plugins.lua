return require("packer").startup({
	function(use)
		use("wbthomason/packer.nvim")

		-- common
		use("chrisbra/Colorizer") -- adds color highlighting to certain filetypes
		use("ggandor/lightspeed.nvim") -- s navigation
		use({ "echasnovski/mini.nvim", branch = "main" }) -- utility functions
		use({
			"rebelot/heirline.nvim",
			config = function()
				require("heirline").setup(require("statusline.main"))
			end,
		})
		use("rhysd/vim-grammarous") -- grammar check
		use("andymass/vim-matchup") -- matching parens and more
		use({
			"mhartington/formatter.nvim",
			config = function()
				local prettier = require("formatter.defaults.prettierd")

				require("formatter").setup({
					logging = true,
					log_level = vim.log.levels.DEBUG,
					filetype = {
						javascript = prettier,
						typescript = require("formatter.filetypes.typescript").prettierd,
						vue = prettier,
						python = require("formatter.filetypes.python").black,
						graphql = prettier,
						prisma = prettier,
						html = prettier,
						lua = require("formatter.filetypes.lua").stylua,
						nix = require("formatter.filetypes.nix").nixfmt,
						["*"] = require("formatter.filetypes.any").remove_trailing_whitespace,
					},
				})
			end,
		}) -- formatting
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
		use({
			"lukas-reineke/indent-blankline.nvim",
			config = function()
				require("ibl").setup()
			end,
		}) -- indent lines
		use({
			"kyazdani42/nvim-tree.lua",
			requires = {
				"kyazdani42/nvim-web-devicons", -- optional, for file icons
			},
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
				require("lspsaga").setup({})
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
		use({
			"ray-x/lsp_signature.nvim",
			config = function()
				require("lsp_signature").setup()
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

		-- kitty
		use({
			"fladson/vim-kitty",
		})
		use({
			"iamcco/markdown-preview.nvim",
			run = "cd app && npm install",
			config = function()
				vim.g.mkdp_filetypes = { "markdown", "mkd" }
				vim.g.mkdp_command_for_global = 1
				vim.g.mkdp_echo_preview_url = 1
				vim.g.mkdp_auto_start = 1
				vim.g.mkdp_open_to_the_world = 1
			end,
		})
	end,
})
