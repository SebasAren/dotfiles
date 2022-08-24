local saga = require('lspsaga')
local action = require("lspsaga.codeaction")

saga.init_lsp_saga()

-- lsp finder to find the cursor word definition and reference
vim.keymap.set("n", "gh", "<cmd>Lspsaga lsp_finder<CR>", { silent = true,noremap = true })

-- code action
vim.keymap.set("n", "<leader>ca", "<cmd>Lspsaga code_action<CR>", { silent = true,noremap = true })
vim.keymap.set("v", "<leader>ca", "<cmd><C-U>Lspsaga range_code_action<CR>", { silent = true,noremap =true })

-- rename
vim.keymap.set("n", "gr", "<cmd>Lspsaga rename<CR>", { silent = true, noremap = true })

-- show hover doc and press twice will jumpto hover window
vim.keymap.set("n", "K", "<cmd>Lspsaga hover_doc<CR>", { silent = true })

-- scroll down hover doc or scroll in definition preview
vim.keymap.set("n", "<C-f>", function()
    action.smart_scroll_with_saga(1)
end, { silent = true })
-- scroll up hover doc
vim.keymap.set("n", "<C-b>", function()
    action.smart_scroll_with_saga(-1)
end, { silent = true })


-- line diagnostic
vim.keymap.set("n", "<leader>cd", require("lspsaga.diagnostic").show_line_diagnostics, { silent = true,noremap = true })

-- jump diagnostic
vim.keymap.set("n", "[e", require("lspsaga.diagnostic").goto_prev, { silent = true, noremap =true })
vim.keymap.set("n", "]e", require("lspsaga.diagnostic").goto_next, { silent = true, noremap =true })

-- or jump to error
vim.keymap.set("n", "[E", function()
  require("lspsaga.diagnostic").goto_prev({ severity = vim.diagnostic.severity.ERROR })
end, { silent = true, noremap = true })
vim.keymap.set("n", "]E", function()
  require("lspsaga.diagnostic").goto_next({ severity = vim.diagnostic.severity.ERROR })
end, { silent = true, noremap = true })
