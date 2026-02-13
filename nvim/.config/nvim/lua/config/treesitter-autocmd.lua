local M = {}

M.filetypes = {
	"bash",
	"c",
	"css",
	"diff",
	"html",
	"javascript",
	"jsdoc",
	"json",
	"jsonc",
	"lua",
	"luadoc",
	"luap",
	"markdown",
	"markdown_inline",
	"printf",
	"python",
	"query",
	"regex",
	"toml",
	"tsx",
	"typescript",
	"vim",
	"vimdoc",
	"vue",
	"xml",
	"yaml",
	"prisma",
	"graphql",
	"astro",
	"http",
}

function M.setup()
	vim.api.nvim_create_augroup("TreesitterAutoAttach", { clear = true })

	vim.api.nvim_create_autocmd("FileType", {
		pattern = M.filetypes,
		group = "TreesitterAutoAttach",
		callback = function()
			vim.treesitter.start()
			vim.wo[0][0].foldexpr = "v:lua.vim.treesitter.foldexpr()"
			vim.wo[0][0].foldmethod = "expr"
			vim.bo.indentexpr = "v:lua.require'nvim-treesitter'.indentexpr()"
		end,
	})
end

return M
