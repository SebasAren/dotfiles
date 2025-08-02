return {
	{
		"lukas-reineke/indent-blankline.nvim",
		config = function()
			require("ibl").setup()
		end,
	}, -- indent lines
	{
		"nvim-treesitter/nvim-treesitter",
		config = function()
			local configs = require("nvim-treesitter.configs")
			configs.setup({
				highlight = { enable = true },
				indent = { enable = true },
				sync_install = false,
				ensure_installed = {
					"bash",
					"c",
					"css",
					"diff",
					"html",
					"javascript",
					"jsdoc",
					"json",
					"jsonc",
					"lua",
					"luadoc",
					"luap",
					"markdown",
					"markdown_inline",
					"printf",
					"python",
					"query",
					"regex",
					"toml",
					"tsx",
					"typescript",
					"vim",
					"vimdoc",
					"vue",
					"xml",
					"yaml",
					"prisma",
					"graphql",
				},
			})
		end,
	},
	{
		"windwp/nvim-ts-autotag",
		opts = {},
		lazy = false,
	},
	-- Python
	-- {
	-- 	"linux-cultist/venv-selector.nvim",
	-- 	branch = "regexp",
	-- 	config = function()
	-- 		require("venv-selector").setup()
	-- 	end,
	-- },
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
	{ "nvim-tree/nvim-web-devicons", lazy = true },
	{
		"folke/which-key.nvim",
		event = "VeryLazy",
		opts = {
			-- your configuration comes here
			-- or leave it empty to use the default settings
			-- refer to the configuration section below
		},
		keys = {
			{
				"<leader>?",
				function()
					require("which-key").show({ global = false })
				end,
				desc = "Buffer Local Keymaps (which-key)",
			},
		},
	},
	{
		"folke/flash.nvim",
		event = "VeryLazy",
		opts = {},
		keys = {
			{
				"<leader>s",
				mode = { "n", "x", "o" },
				function()
					require("flash").jump()
				end,
				desc = "Flash",
			},
			{
				"<leader>S",
				mode = { "n", "x", "o" },
				function()
					require("flash").treesitter()
				end,
				desc = "Flash Treesitter",
			},
			{
				"r",
				mode = "o",
				function()
					require("flash").remote()
				end,
				desc = "Remote Flash",
			},
			{
				"R",
				mode = { "o", "x" },
				function()
					require("flash").treesitter_search()
				end,
				desc = "Treesitter Search",
			},
			{
				"<c-s>",
				mode = { "c" },
				function()
					require("flash").toggle()
				end,
				desc = "Toggle Flash Search",
			},
		},
	},
}
