vim.cmd("noremap <C-b> :noh<cr>:call clearmatches()<cr>") -- clear matches Ctrl+b

local function map(mode, shortcut, command)
	vim.keymap.set(mode, shortcut, command)
end

local function nmap(shortcut, command)
	map("n", shortcut, command)
end

local function vmap(shortcut, command)
	map("v", shortcut, command)
end

local function cmap(shortcut, command)
	map("c", shortcut, command)
end

-- keep search matches in the middle of the window
nmap("n", "nzzzv")
nmap("N", "Nzzzv")

-- Same when jumping around
nmap("g;", "g;zz")

-- Begining & End of line in Normal and visual mode
vim.keymap.set({ "v", "n" }, "H", "^")
vim.keymap.set({ "v", "n" }, "L", "g_")
--
-- Reselect visual block after indent/outdent
vmap("<", "<gv")
vmap(">", ">gv")

-- home and end line in command mode
cmap("<C-a>", "<Home>")
cmap("<C-e>", "<End>")
