return {
  cmd = { "vue-language-server", "--stdio" },
  filetypes = { "vue" },
  init_options = {
    typescript = {
      tsdk = vim.fn.getcwd() .. "/node_modules/typescript/lib",
    },
    vue = {
      hybridMode = true,
    },
  },
  root_markers = { "package.json", ".git" },
}
