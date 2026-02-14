return {
	{
		"saghen/blink.cmp",
		version = "1.*",
		dependencies = {
			"echasnovski/mini.nvim",
			"Kaiser-Yang/blink-cmp-avante",
			{
				"milanglacier/minuet-ai.nvim",
				config = function()
					require("minuet").setup({
						provider_options = {
							codestral = {
								model = "codestral-latest",
								end_point = "https://codestral.mistral.ai/v1/fim/completions",
								api_key = "CODESTRAL_API_KEY",
								stream = true,
								optional = {
									stop = nil, -- the identifier to stop the completion generation
									max_tokens = nil,
								},
							},
						},
					})
				end,
			},
		},
		---@module 'blink.cmp'
		---@type blink.cmp.Config
		opts = {
			keymap = {
				preset = "none",
				["<C-space>"] = { "show", "show_documentation", "fallback" },
				["<C-e>"] = { "cancel" },
				["<Tab>"] = { "select_next", "fallback" },
				["<C-n>"] = { "select_next", "fallback" },
				["<S-Tab>"] = { "select_prev", "fallback" },
				["<C-p>"] = { "select_prev", "fallback" },
				["<C-y>"] = { "accept", "fallback" },
				["<CR>"] = { "accept", "fallback" },
				["<C-f>"] = { "scroll_documentation_down" },
				["<C-b>"] = { "scroll_documentation_up" },
			},
			signature = { enabled = true },
			appearance = {
				nerd_font_variant = "mono",
			},
			completion = {
				list = {
					selection = {
						preselect = false,
					},
					cycle = {
						from_top = false,
					},
				},
				documentation = {
					auto_show = true,
				},
			},
			fuzzy = {
				implementation = "prefer_rust_with_warning",
			},
			snippets = { preset = "mini_snippets" },
			sources = {
				default = { "avante", "lsp", "path", "snippets", "buffer", "minuet" },
				per_filetype = {
					codecompanion = { "codecompanion" },
					AvanteInput = { "avante", "lsp", "path", "snippets", "buffer" },
				},
				providers = {
					avante = {
						module = "blink-cmp-avante",
						name = "Avante",
					},
					minuet = {
						name = "minuet",
						module = "minuet.blink",
						async = true,
						timeout_ms = 3000,
						score_offset = 50,
					},
				},
			},
		},
		opts_extend = { "sources.default" },
	},
}
