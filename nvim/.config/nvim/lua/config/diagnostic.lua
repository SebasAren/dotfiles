vim.diagnostic.config({
	underline = true,
	signs = true,
	float = {
		source = "if_many",
		border = "rounded",
	},
	virtual_text = true,
	jump = { float = true },
})

vim.api.nvim_create_autocmd({ "CursorHold" }, {
	callback = function()
		vim.diagnostic.open_float({
			scope = "cursor",
		})
	end,
})

-- toggle diagnostics
vim.keymap.set("n", "<leader>xd", function()
	vim.diagnostic.enable(not vim.diagnostic.is_enabled())
end, { desc = "Toggle diagnostic virtual text" })
