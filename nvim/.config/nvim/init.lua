require("config.lazy")

require("config.filetypes")
require("config.settings")
require("config.mappings")
require("config.lsp")
require("config.diagnostic")

-- Code review setup
require("review").setup({
	keys = {
		add = false,
		delete = false,
		list = false,
		save = false,
		clear = false,
	},
})

pcall(function()
	require("custom-settings")
end)
