require("config.lazy")

-- Add startup profiling
vim.api.nvim_create_autocmd("UIEnter", {
	callback = function()
		local stats = require("lazy").stats()
		local ms = (math.floor(stats.startuptime * 100 + 0.5) / 100)
		local message = string.format("⚡ Neovim loaded %d/%d plugins in %sms", stats.loaded, stats.count, ms)
		require("noice").notify(message, vim.log.levels.INFO, { title = "Startup Stats" })
	end,
})

require("config.filetypes")
require("config.settings")
require("config.mappings")
require("config.lsp")
require("config.diagnostic")
pcall(function()
	require("custom-settings")
end)
