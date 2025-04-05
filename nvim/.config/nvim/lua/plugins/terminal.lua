return {
	{
		"akinsho/toggleterm.nvim",
		branch = "main",
		opts = {
			open_mapping = [[<c-\>]],
		},
		config = function()
			local function map(mode, shortcut, command)
				vim.api.nvim_set_keymap(mode, shortcut, command, { noremap = true, silent = true })
			end
			function _G.set_terminal_keymaps()
				map("t", "<esc>", [[ <C-\><C-n> ]])
				map("t", "<C-h>", [[<C-\><C-n><C-W>h]])
				map("t", "<C-j>", [[<C-\><C-n><C-W>j]])
				map("t", "<C-k>", [[<C-\><C-n><C-W>k]])
				map("t", "<C-l>", [[<C-\><C-n><C-W>l]])
			end

			vim.cmd("autocmd! TermOpen term://*toggleterm#* lua set_terminal_keymaps()")
			local Terminal = require("toggleterm.terminal").Terminal
			local lazygit = Terminal:new({
				cmd = "lazygit",
				hidden = true,
				direction = "float",
			})

			local function lazygit_toggle()
				lazygit:toggle()
			end

			map("n", "<leader>gg", "<cmd>lua lazygit_toggle()<CR>")
		end,
	},
}
