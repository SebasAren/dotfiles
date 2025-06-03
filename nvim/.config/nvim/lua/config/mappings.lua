vim.keymap.set({ "v", "n" }, "<C-b>", ":noh<cr>:call clearmatches()<cr>")

-- keep search matches in the middle of the window
vim.keymap.set("n", "n", "nzzzv")
vim.keymap.set("n", "N", "Nzzzv")

-- Same when jumping around
vim.keymap.set("n", "g;", "g;zz")

-- Begining & End of line in Normal and visual mode
vim.keymap.set({ "v", "n" }, "H", "^")
vim.keymap.set({ "v", "n" }, "L", "g_")

-- Reselect visual block after indent/outdent
vim.keymap.set("v", "<", "<gv")
vim.keymap.set("v", ">", ">gv")

-- home and end line in command mode
vim.keymap.set("c", "<C-a>", "<Home>")
vim.keymap.set("c", "<C-d>", "<End>")
