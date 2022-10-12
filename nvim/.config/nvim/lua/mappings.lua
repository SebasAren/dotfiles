vim.cmd('noremap <C-b> :noh<cr>:call clearmatches()<cr>') -- clear matches Ctrl+b

local function map(mode, shortcut, command)
  vim.api.nvim_set_keymap(mode, shortcut, command, { noremap = true, silent = true })
end

local function nmap(shortcut, command)
  map('n', shortcut, command)
end

local function imap(shortcut, command)
  map('i', shortcut, command)
end

local function vmap(shortcut, command)
  map('v', shortcut, command)
end

local function cmap(shortcut, command)
  map('c', shortcut, command)
end

local function tmap(shortcut, command)
  map('t', shortcut, command)
end

-- sane regexes
nmap('/', '/\\v')
vmap('/', '/\\v')

-- don't jump when using *
nmap('*', '*<c-o>')

-- keep search matches in the middle of the window
nmap('n', 'nzzzv')
nmap('N', 'Nzzzv')

-- Same when jumping around
nmap('g;', 'g;zz')
--nmap('g', 'g,zz') -- for some reason doesn't work well

-- Open a Quickfix window for the last search.
nmap("<leader>?", ":execute 'vimgrep /'.@/.'/g %'<CR>:copen<CR>")

-- Begining & End of line in Normal mode
nmap('H', '^')
nmap('L', 'g_')

-- more natural movement with wrap on
nmap('j', 'gj')
nmap('k', 'gk')
vmap('j', 'gj')
vmap('k', 'gk')

-- Reselect visual block after indent/outdent
vmap('<', '<gv')
vmap('>', '>gv')

-- home and end line in command mode
cmap('<C-a>', '<Home>')
cmap('<C-e>', '<End>')

-- Easy window split; C-w v -> vv, C-w - s -> ss
nmap('<leader>v', '<C-w>v')
nmap('<leader>s', '<C-w>s')
vim.o.splitbelow = true -- when splitting horizontally, move coursor to lower pane
vim.o.splitright = true -- when splitting vertically, mnove coursor to right pane

-- PLUGINS
-- Find files using Telescope command-line sugar.
nmap("<leader>p", "<cmd>Telescope find_files<cr>")
nmap("<leader>rg", "<cmd>Telescope live_grep<cr>")
nmap("<leader>bb", "<cmd>Telescope buffers<cr>")
nmap("<leader>hh", "<cmd>Telescope help_tags<cr>")
nmap("<leader>rt", "<cmd>lua require'telescope.builtin'.treesitter{}<cr>")
nmap("<leader>gw", "<cmd>lua require('telescope').extensions.git_worktree.git_worktrees()<cr>")
nmap("<leader>ga", "<cmd>lua require('telescope').extensions.git_worktree.create_git_worktree()<cr>")

-- argwrap
nmap('<leader>a', '<cmd>ArgWrap<cr>')

-- git
nmap('<C-g>', '<cmd>GitMessenger<cr>')

-- CHADtree
nmap('<leader>n', '<cmd>NvimTreeToggle<CR>')

-- buffers
nmap('<A-,>', '<cmd>BufferPrevious<CR>')
nmap('<A-.>', '<cmd>BufferNext<CR>')
nmap('<A-<>', '<cmd>BufferMovePrevious<CR>')
nmap('<A->>', '<cmd>BufferMoveNext<CR>')
nmap('<A-p>', '<cmd>BufferPin<CR>')
nmap('<A-c>', '<cmd>BufferClose<CR>')
nmap('<C-s>', '<cmd>BufferPick<CR>')
for i = 1, 9 do
  nmap(string.format('<A-%d>', i), string.format('<cmd>BufferGoto %d<cr>', i))
end

-- toggleterm
function _G.set_terminal_keymaps()
  tmap('<esc>', [[ <C-\><C-n> ]])
  tmap('<C-h>', [[<C-\><C-n><C-W>h]])
  tmap('<C-j>', [[<C-\><C-n><C-W>j]])
  tmap('<C-k>', [[<C-\><C-n><C-W>k]])
  tmap('<C-l>', [[<C-\><C-n><C-W>l]])
end

vim.cmd('autocmd! TermOpen term://*toggleterm#* lua set_terminal_keymaps()')

-- testing
nmap('<leader>tt', '<cmd>TestNearest<cr>')
nmap('<leader>tT', '<cmd>TestFile<cr>')
nmap('<leader>ta', '<cmd>TestSuite<cr>')
nmap('<leader>tl', '<cmd>TestLast<cr>')
nmap('<leader>tg', '<cmd>TestVisit<cr>')

-- harpoon
nmap('<leader>mm', '<cmd>lua require("harpoon.mark").add_file()<cr>')
nmap('<leader>ml', '<cmd>lua require("harpoon.ui").toggle_quick_menu()<cr>')

for i = 1, 9 do
  nmap(string.format('<leader>m%d', i), string.format('<cmd>lua require("harpoon.ui").nav_file(%d)<cr>', i))
  nmap(string.format('<leader>h%d', i), string.format('<cmd>lua require("harpoon.term").gotoTerminal(%d)<cr>', i))
end
nmap('<leader>hl', '<cmd>lua require("harpoon.cmd-ui").toggle_quick_menu()<cr>')
nmap('gcc', '<cmd>ComComment<cr>')
map('x', 'gcc', ':ComComment<cr>')
nmap('gcj', '<cmd>ComAnnotation<Cr>')

nmap('<leader>mc', '<cmd>lua require("mini.map").close()<cr>')
nmap('<leader>mf', '<cmd>lua require("mini.map").toggle_focus()<cr>')
nmap('<leader>mo', '<cmd>lua require("mini.map").open()<cr>')
nmap('<leader>mr', '<cmd>lua require("mini.map").refresh()<cr>')
nmap('<leader>ms', '<cmd>lua require("mini.map").toggle_side()<cr>')
nmap('<leader>mt', '<cmd>lua require("mini.map").toggle()<cr>')
