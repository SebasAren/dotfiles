local conditions = require("heirline.conditions")
local utils = require("heirline.utils")

local Align = { provider = "%=" }
local Space = { provider = " " }

local StatusLine = {
	require("statusline.vimode"),
	Space,
	require("statusline.filename"),
	Space,
	require("statusline.git"),
	Align,
}

return {
	statusline = StatusLine,
}
