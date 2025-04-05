local conditions = require("heirline.conditions")
local utils = require("heirline.utils")

local Align = { provider = "%=" }
local Space = { provider = " " }
local Ruler = { provider = "%7(%l/%3L%):%2c %P" }
local ScrollBar = {
	static = {
		sbar = { "🭶", "🭷", "🭸", "🭹", "🭺", "🭻" },
	},
	provider = function(self)
		local curr_line = vim.api.nvim_win_get_cursor(0)[1]
		local lines = vim.api.nvim_buf_line_count(0)
		local i = math.floor((curr_line - 1) / lines * #self.sbar) + 1
		return string.rep(self.sbar[i], 2)
	end,
}

local StatusLine = {
	require("config.statusline.vimode"),
	Space,
	require("config.statusline.filename"),
	Space,
	require("config.statusline.git"),
	Align,
	Ruler,
	Space,
	ScrollBar,
}

return {
	statusline = StatusLine,
}
