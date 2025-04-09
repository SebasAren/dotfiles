return {
	{
		"saghen/blink.cmp",
		version = "1.*",
		dependencies = {
			"echasnovski/mini.nvim",
		},
		---@module 'blink.cmp'
		---@type blink.cmp.Config
		opts = {
			keymap = { preset = "default" },
			appearance = { nerd_font_variant = "mono" },
			fuzzy = {
				implementation = "prefer_rust_with_warning",
			},
			snippets = { preset = "mini_snippets" },
			sources = { default = { "lsp", "path", "snippets", "buffer" } },
		},
		opts_extend = { "sources.default" },
	},
}
