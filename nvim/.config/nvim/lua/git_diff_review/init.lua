-- git_diff_review — Lightweight diff review mode for wpi workflows
--
-- Opens a review session that populates the quickfix list with all changed
-- hunks (via gitsigns) and provides easy navigation between changes across
-- files. Designed to replace the fzf-lua git_diff picker in the wpi review
-- step with a more immersive experience.
--
-- Usage:
--   :GitDiffReview          — diff against merge-base of current branch
--   :GitDiffReview main     — diff against a specific ref
--   <leader>gD              — keymap (respects WPI_BASE_REF / WPI_BASE_BRANCH)
--
-- Keymaps during review session:
--   [q / ]q   — prev/next quickfix entry (jumps across files)
--   [h / ]h   — prev/next hunk within current file
--   <leader>gd — side-by-side diffthis for current file
--   <leader>gB — reopen fzf-lua git_diff picker
--   q         — close review session

local M = {}

--- Whether we're in an active review session
M.active = false

--- The base ref we're diffing against
M.base_ref = nil

local group = vim.api.nvim_create_augroup("git_diff_review", { clear = true })

--- Resolve the base ref for diffing.
--- Priority: arg > WPI_BASE_REF > WPI_BASE_BRANCH > merge-base with main
---@param ref? string Explicit ref passed by user
---@return string
local function resolve_base_ref(ref)
	if ref and ref ~= "" then
		return ref
	end
	if vim.env.WPI_BASE_REF and vim.env.WPI_BASE_REF ~= "" then
		return vim.env.WPI_BASE_REF
	end
	if vim.env.WPI_BASE_BRANCH and vim.env.WPI_BASE_BRANCH ~= "" then
		return vim.env.WPI_BASE_BRANCH
	end
	-- Fallback: merge-base with main branch
	local ok, result = pcall(vim.fn.systemlist, {
		cmd = "git merge-base main HEAD",
	})
	if ok and vim.v.shell_error == 0 and #result > 0 then
		return result[1]
	end
	return "HEAD~1"
end

--- Get list of changed files (including untracked) against base ref
---@param base_ref string
---@return string[]
local function get_changed_files(base_ref)
	local files = {}

	-- Tracked changes (committed since base)
	local ok, result = pcall(vim.fn.systemlist, {
		cmd = string.format("git diff --name-only %s HEAD -- .", base_ref),
	})
	if ok and vim.v.shell_error == 0 then
		for _, f in ipairs(result) do
			if f ~= "" then
				files[f] = true
			end
		end
	end

	-- Working tree + staged changes vs base (includes unstaged edits)
	ok, result = pcall(vim.fn.systemlist, {
		cmd = string.format("git diff --name-only %s -- .", base_ref),
	})
	if ok and vim.v.shell_error == 0 then
		for _, f in ipairs(result) do
			if f ~= "" then
				files[f] = true
			end
		end
	end

	-- Untracked files (new files not yet added to git)
	ok, result = pcall(vim.fn.systemlist, {
		cmd = "git ls-files --others --exclude-standard -- .",
	})
	if ok and vim.v.shell_error == 0 then
		for _, f in ipairs(result) do
			if f ~= "" then
				files[f] = true
			end
		end
	end

	local list = vim.tbl_keys(files)
	table.sort(list)
	return list
end

--- Populate quickfix with all changed hunks using gitsigns,
--- supplemented with files gitsigns hasn't attached to yet.
---@param base_ref string
local function populate_quickfix(base_ref)
	local gs = require("gitsigns")

	-- gitsigns setqflist('all') covers all modified files it tracks
	local ok, err = pcall(gs.setqflist, "all", { open = false })
	if not ok then
		vim.notify("gitsigns setqflist failed: " .. tostring(err), vim.log.levels.WARN)
	end

	-- Supplement with any files that gitsigns might have missed
	-- (new/untracked files not yet attached)
	local qf_items = vim.fn.getqflist()
	local qf_files = {}
	for _, item in ipairs(qf_items) do
		if item.filename then
			qf_files[vim.fn.fnamemodify(item.filename, ":.")] = true
		end
	end

	local changed = get_changed_files(base_ref)
	for _, file in ipairs(changed) do
		if not qf_files[file] then
			table.insert(qf_items, {
				filename = file,
				lnum = 1,
				col = 1,
				text = "[new/untracked file]",
			})
		end
	end

	vim.fn.setqflist({}, "r", {
		title = string.format("Diff Review vs %s (%d files)", base_ref, #changed),
		items = qf_items,
	})
end

--- Set buffer-local keymaps for the review session
---@param bufnr integer
local function setup_buffer_keymaps(bufnr)
	local function bmap(mode, lhs, rhs, desc)
		vim.keymap.set(mode, lhs, rhs, { buffer = bufnr, desc = desc })
	end

	-- Navigate quickfix entries (jumps across files)
	bmap("n", "[q", "<cmd>cprev<cr>zz", "Review: prev change")
	bmap("n", "]q", "<cmd>cnext<cr>zz", "Review: next change")
	bmap("n", "[Q", "<cmd>cfirst<cr>zz", "Review: first change")
	bmap("n", "]Q", "<cmd>clast<cr>zz", "Review: last change")

	-- Override <leader>gd to always use the review session's base ref
	-- (gitsigns on_attach already sets this, but we override to be explicit)
	bmap("n", "<leader>gd", function()
		require("gitsigns").diffthis(M.base_ref)
	end, "Review: diff file vs base")

	-- Open the fzf-lua diff picker to browse files
	bmap("n", "<leader>gB", function()
		require("fzf-lua").git_diff({ ref = M.base_ref })
	end, "Review: file picker")

	-- Close review session
	bmap("n", "q", function()
		M.close()
	end, "Review: close session")
end

--- Set up autocmds for the review session
local function setup_autocmds()
	-- Apply review keymaps to any new buffer entered during review
	vim.api.nvim_create_autocmd("BufEnter", {
		group = group,
		callback = function(ev)
			if not M.active then
				return
			end
			local buftype = vim.bo[ev.buf].buftype
			if buftype ~= "" then
				return
			end
			-- Skip if our mappings already exist on this buffer
			if vim.fn.maparg("]q", "n", false, false).buffer == 1 then
				return
			end
			setup_buffer_keymaps(ev.buf)
		end,
	})

	-- Enhance quickfix window during review
	vim.api.nvim_create_autocmd("FileType", {
		group = group,
		pattern = "qf",
		callback = function(ev)
			if not M.active then
				return
			end

			-- Enter: jump to the change and apply review keymaps
			vim.keymap.set("n", "<cr>", function()
				vim.cmd("cc")
				setup_buffer_keymaps(vim.api.nvim_get_current_buf())
			end, { buffer = ev.buf, nowait = true, desc = "Review: jump to change" })

			-- q: close quickfix (but don't end review session)
			vim.keymap.set("n", "q", function()
				vim.cmd("cclose")
			end, { buffer = ev.buf, nowait = true, desc = "Review: close quickfix" })
		end,
	})
end

--- Start a diff review session
---@param ref? string Base ref to diff against
function M.open(ref)
	M.base_ref = resolve_base_ref(ref)
	M.active = true

	-- Clean up previous session state
	vim.api.nvim_clear_autocmds({ group = group })

	-- Populate quickfix and open it
	populate_quickfix(M.base_ref)
	vim.cmd("copen")
	vim.cmd("wincmd p")

	-- Apply keymaps to current buffer
	setup_buffer_keymaps(vim.api.nvim_get_current_buf())

	-- Set up autocmds for future buffers
	setup_autocmds()

	-- Jump to first change
	vim.schedule(function()
		vim.cmd("cfirst")
	end)

	local changed = get_changed_files(M.base_ref)
	vim.notify(
		string.format(
			"Review: %d files changed vs %s\n]q next change · [q prev · ]h next hunk · gd side-by-side · q close",
			#changed,
			M.base_ref
		),
		vim.log.levels.INFO
	)
end

--- End the review session
function M.close()
	if not M.active then
		return
	end
	M.active = false
	M.base_ref = nil
	vim.api.nvim_clear_autocmds({ group = group })
	vim.cmd("cclose")

	-- Clean up buffer-local keymaps
	for _, buf in ipairs(vim.api.nvim_list_bufs()) do
		if vim.api.nvim_buf_is_valid(buf) and vim.bo[buf].buftype == "" then
			for _, key in ipairs({ "]q", "[q", "]Q", "[Q", "<leader>gd", "<leader>gB", "q" }) do
				pcall(vim.keymap.del, "n", key, { buffer = buf })
			end
		end
	end

	vim.notify("Review session ended", vim.log.levels.INFO)
end

return M
