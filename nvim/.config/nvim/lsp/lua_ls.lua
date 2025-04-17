return {
	settings = {
		Lua = {
			runtime = {
				version = "LuaJIT",
				path = {
					"?/init.lua",
					"?.lua",
				},
			},
			diagnostics = {
				globals = { "vim", "awesome", "client", "root" },
			},
			workspace = {
				library = {
					vim.api.nvim_get_runtime_file("", true),
					"/usr/share/awesome/lib",
					"/usr/share/lua/5.3/lain",
					"/usr/share/lua/5.3/freedesktop",
				},
			},
			telemetry = {
				enable = false,
			},
		},
	},
}
