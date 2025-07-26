require("config.lazy")

-- Add startup profiling
vim.api.nvim_create_autocmd("VimEnter", {
	callback = function()
		local stats = require("lazy").stats()
		local ms = (math.floor(stats.startuptime * 100 + 0.5) / 100)
		local message = string.format(
			"⚡ Neovim loaded %d/%d plugins in %sms",
			stats.loaded,
			stats.count,
			ms
		)
		-- Use notify for better visibility if available
		if vim.fn.exists(':Notify') == 2 then
			vim.notify(message, vim.log.levels.INFO, { title = "Startup Stats" })
		else
			print(message)
		end
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
