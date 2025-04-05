local formatGroup = vim.api.nvim_create_augroup("FormatAutogroup", { clear = true })
local is_formatting_enabled = true

local function toggle_formatting()
	is_formatting_enabled = not is_formatting_enabled
	if is_formatting_enabled then
		vim.api.nvim_create_autocmd("BufWritePost", {
			command = "FormatWriteLock",
			group = formatGroup,
		})
		vim.notify("Auto-formatting enabled", vim.log.levels.INFO)
	else
		vim.api.nvim_clear_autocmds({ group = formatGroup })
		vim.notify("Auto-formatting disabled", vim.log.levels.WARN)
	end
end

-- Set up the autocmd initially
vim.api.nvim_create_autocmd("BufWritePost", {
	command = "FormatWriteLock",
	group = formatGroup,
})

-- Keybind to toggle auto-formatting (e.g., <leader>tf)
vim.keymap.set("n", "<leader>tf", toggle_formatting, { desc = "Toggle auto-formatting" })
