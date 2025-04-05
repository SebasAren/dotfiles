vim.cmd("noremap <C-b> :noh<cr>:call clearmatches()<cr>") -- clear matches Ctrl+b

local function map(mode, shortcut, command)
	vim.api.nvim_set_keymap(mode, shortcut, command, { noremap = true, silent = true })
end

local function nmap(shortcut, command)
	map("n", shortcut, command)
end

local function imap(shortcut, command)
	map("i", shortcut, command)
end

local function vmap(shortcut, command)
	map("v", shortcut, command)
end

local function cmap(shortcut, command)
	map("c", shortcut, command)
end

local function tmap(shortcut, command)
	map("t", shortcut, command)
end

-- sane regexes
nmap("/", "/\\v")
vmap("/", "/\\v")

-- keep search matches in the middle of the window
nmap("n", "nzzzv")
nmap("N", "Nzzzv")

-- Same when jumping around
nmap("g;", "g;zz")
--nmap('g', 'g,zz') -- for some reason doesn't work well

-- Open a Quickfix window for the last search.
nmap("<leader>?", ":execute 'vimgrep /'.@/.'/g %'<CR>:copen<CR>")

-- Begining & End of line in Normal mode
nmap("H", "^")
nmap("L", "g_")
--
-- Begining & End of line in visual mode
vmap("H", "^")
vmap("L", "g_")

-- more natural movement with wrap on
nmap("j", "gj")
nmap("k", "gk")
vmap("j", "gj")
vmap("k", "gk")

-- Reselect visual block after indent/outdent
vmap("<", "<gv")
vmap(">", ">gv")

-- home and end line in command mode
cmap("<C-a>", "<Home>")
cmap("<C-e>", "<End>")

-- Easy window split; C-w v -> vv, C-w - s -> ss
nmap("<leader>v", "<C-w>v")
nmap("<leader>s", "<C-w>s")
vim.o.splitbelow = true -- when splitting horizontally, move coursor to lower pane
vim.o.splitright = true -- when splitting vertically, mnove coursor to right pane

-- PLUGINS
-- toggleterm
function _G.set_terminal_keymaps()
	tmap("<esc>", [[ <C-\><C-n> ]])
	tmap("<C-h>", [[<C-\><C-n><C-W>h]])
	tmap("<C-j>", [[<C-\><C-n><C-W>j]])
	tmap("<C-k>", [[<C-\><C-n><C-W>k]])
	tmap("<C-l>", [[<C-\><C-n><C-W>l]])
end

vim.cmd("autocmd! TermOpen term://*toggleterm#* lua set_terminal_keymaps()")
