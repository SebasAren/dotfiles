local vue_language_server_path = require("mason-registry").get_package("vue-language-server"):get_install_path()
	.. "/node_modules/@vue/language-server"

return {
	filetypes = { "vue", "javascript", "typescript", "javascriptreact", "typescriptreact" },
	init_options = {
		plugins = {
			{
				name = "@vue/typescript-plugin",
				location = vue_language_server_path,
				languages = { "vue" },
			},
		},
	},
}
