require("plugins")
require("settings")
require("mappings")
require("autocompletion")
require("git-config")
require("lsp-config")
require("worktree")
require("dap-settings")
require("lsp-saga")
require("terminals")
require("formatting")
require("telescope-config")
pcall(function()
	require("custom-settings")
end)
