return {
	{
		"akinsho/toggleterm.nvim",
		branch = "main",
		config = function()
			require("toggleterm").setup({
				open_mapping = [[<c-\>]],
			})

			local function set_terminal_keymaps()
				local opts = { buffer = 0 }
				vim.keymap.set("t", "<esc>", [[<C-\><C-n>]], opts)
				vim.keymap.set("t", "<C-h>", [[<C-\><C-n><C-W>h]], opts)
				vim.keymap.set("t", "<C-j>", [[<C-\><C-n><C-W>j]], opts)
				vim.keymap.set("t", "<C-k>", [[<C-\><C-n><C-W>k]], opts)
				vim.keymap.set("t", "<C-l>", [[<C-\><C-n><C-W>l]], opts)
			end

			vim.api.nvim_create_autocmd("TermOpen", {
				pattern = "term://*toggleterm#*",
				callback = set_terminal_keymaps,
			})

			local Terminal = require("toggleterm.terminal").Terminal
			local lazygit = Terminal:new({
				cmd = "lazygit",
				hidden = true,
				direction = "float",
			})

			local function lazygit_toggle()
				lazygit:toggle()
			end

			vim.keymap.set("n", "<leader>gg", lazygit_toggle, { desc = "Toggle lazygit" })
		end,
	},
}
