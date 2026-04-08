-- review.nvim — code review annotations for agent-assisted workflows
-- Annotate code in neovim, save to .code-review.md, let an agent apply the changes.
-- Heavily inspired by https://github.com/scristobal/code-review.nvim

local M = {}

local comments = {}
local ns = vim.api.nvim_create_namespace("code_review")

local config = {
	output_path = ".code-review.md",
	keys = {
		add = " ra",
		delete = " rd",
		list = " rl",
		save = false,
		clear = " rx",
	},
	sign = { text = "▐", hl = "DiagnosticInfo" },
	virt_text = { hl = "DiagnosticInfo" },
}

local function open_input(opts)
	local width = math.min(80, math.floor(vim.o.columns * 0.8))
	local height = math.min(16, math.floor(vim.o.lines * 0.3))
	local row = math.floor((vim.o.lines - height) / 2)
	local col = math.floor((vim.o.columns - width) / 2)

	local buf = vim.api.nvim_create_buf(false, true)
	vim.api.nvim_buf_set_name(buf, "review://input")
	vim.bo[buf].bufhidden = "wipe"
	vim.bo[buf].buftype = "nofile"
	vim.bo[buf].filetype = "markdown"

	local win = vim.api.nvim_open_win(buf, true, {
		relative = "editor",
		row = row,
		col = col,
		width = width,
		height = height,
		style = "minimal",
		border = { "╭", "─", "╮", "│", "╯", "─", "╰", "│" },
		title = " " .. opts.prompt .. " ",
		title_pos = "center",
	})
	vim.wo[win].wrap = true
	vim.wo[win].linebreak = true
	vim.wo[win].signcolumn = "no"

	local function close()
		if vim.api.nvim_win_is_valid(win) then
			vim.api.nvim_win_close(win, true)
		end
	end

	vim.keymap.set("n", "q", close, { buffer = buf, nowait = true })
	vim.keymap.set("n", "<Esc>", close, { buffer = buf, nowait = true })
	vim.keymap.set({ "n", "i" }, "<CR>", function()
		local lines = vim.api.nvim_buf_get_lines(buf, 0, -1, false)
		local text = table.concat(lines, "\n"):match("^%s*(.-)%s*$")
		close()
		if text ~= "" then
			opts.callback(text)
		end
	end, { buffer = buf })
	vim.keymap.set("i", "<C-CR>", function()
		-- insert a literal newline in insert mode
		vim.api.nvim_put({ "" }, "l", false, true)
	end, { buffer = buf })

	vim.cmd("startinsert")
end

function M.add(line_start, line_end)
	local file = vim.fn.expand("%:.")
	local bufnr = vim.api.nvim_get_current_buf()

	open_input({
		prompt = "Review Comment",
		callback = function(text)
			table.insert(comments, {
				file = file,
				line_start = line_start,
				line_end = line_end,
				text = text,
				bufnr = bufnr,
			})

			M._render(bufnr)
			M._sync_qflist()
			M.save()
		end,
	})
end

function M.delete()
	local file = vim.fn.expand("%:.")
	local line = vim.fn.line(".")
	local bufnr = vim.api.nvim_get_current_buf()

	for i = #comments, 1, -1 do
		local c = comments[i]
		if c.file == file and line >= c.line_start and line <= c.line_end then
			table.remove(comments, i)
			M._render(bufnr)
			M._sync_qflist()
			M.save()
			print("Review comment removed")
			return
		end
	end
	print("No review comment at cursor")
end

---@return table[] quickfix items built from comments
local function build_qf_items()
	local items = {}
	for _, c in ipairs(comments) do
		table.insert(items, {
			filename = c.file,
			lnum = c.line_start,
			end_lnum = c.line_end,
			text = c.text,
			type = "I",
		})
	end
	return items
end

---Clear comments from all buffers (shared by clear() and fs watcher)
local function clear_all()
	local bufs = {}
	for _, c in ipairs(comments) do
		bufs[c.bufnr] = true
	end
	comments = {}
	for bufnr in pairs(bufs) do
		if vim.api.nvim_buf_is_valid(bufnr) then
			vim.api.nvim_buf_clear_namespace(bufnr, ns, 0, -1)
		end
	end
end

function M.clear()
	clear_all()
	M.save()
	print("All review comments cleared")
end

function M._sync_qflist()
	local qf = vim.fn.getqflist({ title = 0 })
	if qf.title ~= "Code Review" then
		return
	end
	vim.fn.setqflist({}, "r", { title = "Code Review", items = build_qf_items() })
end

function M.list()
	if #comments == 0 then
		print("No review comments")
		return
	end
	vim.fn.setqflist({}, " ", { title = "Code Review", items = build_qf_items() })
	vim.cmd("copen")
end

function M.save()
	local path = config.output_path

	if #comments == 0 then
		vim.fn.delete(path)
		return
	end

	local lines = {
		"# Code Review",
		"",
		"Apply the following review comments to the codebase.",
		"",
		"---",
		"",
	}

	for i, c in ipairs(comments) do
		local location
		if c.line_start == c.line_end then
			location = string.format("%s:%d", c.file, c.line_start)
		else
			location = string.format("%s:%d-%d", c.file, c.line_start, c.line_end)
		end
		table.insert(lines, string.format("## %d. %s", i, location))
		table.insert(lines, "")

		local ext = vim.fn.fnamemodify(c.file, ":e")
		table.insert(lines, "```" .. ext)

		local buf = vim.fn.bufnr(c.file)
		local code_lines
		if buf ~= -1 and vim.api.nvim_buf_is_loaded(buf) then
			code_lines = vim.api.nvim_buf_get_lines(buf, c.line_start - 1, c.line_end, false)
		else
			local all = vim.fn.readfile(c.file)
			code_lines = vim.list_slice(all, c.line_start, c.line_end)
		end
		for _, l in ipairs(code_lines or {}) do
			table.insert(lines, l)
		end

		table.insert(lines, "```")
		table.insert(lines, "")
		table.insert(lines, c.text)
		table.insert(lines, "")
		table.insert(lines, "---")
		table.insert(lines, "")
	end

	vim.fn.writefile(lines, path)
end

function M.count()
	return #comments
end

function M._render(bufnr)
	vim.api.nvim_buf_clear_namespace(bufnr, ns, 0, -1)
	local current_file = vim.fn.fnamemodify(vim.api.nvim_buf_get_name(bufnr), ":.")

	for _, c in ipairs(comments) do
		if c.file == current_file then
			pcall(vim.api.nvim_buf_set_extmark, bufnr, ns, c.line_start - 1, 0, {
				virt_text = { { " " .. c.text, config.virt_text.hl } },
				virt_text_pos = "eol",
			})
			for line = c.line_start, c.line_end do
				pcall(vim.api.nvim_buf_set_extmark, bufnr, ns, line - 1, 0, {
					sign_text = config.sign.text,
					sign_hl_group = config.sign.hl,
					priority = 20,
				})
			end
		end
	end
end

function M.setup(opts)
	config = vim.tbl_deep_extend("force", config, opts or {})

	if config.keys.add then
		vim.keymap.set("n", config.keys.add, function()
			M.add(vim.fn.line("."), vim.fn.line("."))
		end, { desc = "Review: add comment" })

		vim.keymap.set("x", config.keys.add, function()
			local start = vim.fn.getpos("v")[2]
			local stop = vim.fn.getpos(".")[2]
			if start > stop then
				start, stop = stop, start
			end
			vim.schedule(function()
				M.add(start, stop)
			end)
			return " "
		end, { desc = "Review: add comment on selection", expr = true })
	end

	if config.keys.delete then
		vim.keymap.set("n", config.keys.delete, M.delete, { desc = "Review: delete comment" })
	end
	if config.keys.list then
		vim.keymap.set("n", config.keys.list, M.list, { desc = "Review: list comments" })
	end
	if config.keys.save then
		vim.keymap.set("n", config.keys.save, M.save, { desc = "Review: save to file" })
	end
	if config.keys.clear then
		vim.keymap.set("n", config.keys.clear, M.clear, { desc = "Review: clear all" })
	end

	local group = vim.api.nvim_create_augroup("code_review", { clear = true })

	vim.api.nvim_create_autocmd("BufEnter", {
		group = group,
		callback = function(ev)
			M._render(ev.buf)
		end,
	})

	-- Watch for .code-review.md being deleted externally (e.g. by an agent)
	local w = vim.uv.new_fs_event()
	local path = vim.fn.fnamemodify(config.output_path, ":p")

	local function watch()
		w:stop()
		w:start(vim.fn.fnamemodify(path, ":h"), {}, function(err, filename)
			if err or filename ~= vim.fn.fnamemodify(path, ":t") then
				return
			end
			vim.schedule(function()
				if vim.fn.filereadable(path) == 0 and #comments > 0 then
					clear_all()
					M._sync_qflist()
					print("Review comments cleared (file deleted)")
				end
				watch()
			end)
		end)
	end
	watch()
end

return M
