return require('packer').startup { function(use)
  use 'wbthomason/packer.nvim'

  -- common
  use 'chrisbra/Colorizer' -- adds color highlighting to certain filetypes
  use 'ggandor/lightspeed.nvim' -- s navigation
  use 'nvim-lualine/lualine.nvim' -- statusline
  use { 'echasnovski/mini.nvim', branch = 'main' } -- utility functions
  use 'rhysd/vim-grammarous' -- grammar check
  use 'andymass/vim-matchup' -- matching parens and more
  use 'mhartington/formatter.nvim' -- formatting
  use 'tpope/vim-surround'
  use {
    'ms-jpq/chadtree',
    branch = 'chad',
    run = 'python3 -m chadtree deps',
  } -- file browser
  use 'marko-cerovac/material.nvim' -- material colourscheme
  use 'ryanoasis/vim-devicons' -- icons for plugins
  use 'adelarsq/vim-devicons-emoji' -- more icons for plugins
  use 'lukas-reineke/indent-blankline.nvim' -- indent lines
  use { 'romgrk/barbar.nvim', requires = { 'kyazdani42/nvim-web-devicons' } } -- tab bar on top of screen and easy mappings
  use 'chentoast/marks.nvim' -- simpler mark navigation
  use 'FooSoft/vim-argwrap' -- argument wrapper
  use 'natecraddock/workspaces.nvim' -- workspace support

  -- git
  use 'rhysd/git-messenger.vim' -- see latest commit of line
  use {
    'tanvirtin/vgit.nvim', -- easy staging from within buffer
    requires = {
      'nvim-lua/plenary.nvim'
    }
  }
  use { 'kdheepak/lazygit.nvim', branch = 'main' } -- layzygit integration
  use {'ThePrimeagen/git-worktree.nvim', config = function()
    require('git-worktree').setup{}
  end
  }

  -- general dev
  use {
    "williamboman/nvim-lsp-installer",
    {
      "neovim/nvim-lspconfig",
      config = function()
        require("nvim-lsp-installer").setup{
          automatic_installation = true
        }
        local lspconfig = require("lspconfig")
        lspconfig.sumneko_lua.setup{}
        lspconfig.volar.setup{}
        lspconfig.tsserver.setup{}
        lspconfig.pyright.setup{}
        lspconfig.eslint.setup{}
        lspconfig.svelte.setup{}
      end
    }
  }
  use {
    "RishabhRD/popfix",
    {
      "RishabhRD/nvim-lsputils",
      config = function()
        vim.lsp.handlers['textDocument/codeAction'] = require'lsputil.codeAction'.code_action_handler
        vim.lsp.handlers['textDocument/references'] = require'lsputil.locations'.references_handler
        vim.lsp.handlers['textDocument/definition'] = require'lsputil.locations'.definition_handler
        vim.lsp.handlers['textDocument/declaration'] = require'lsputil.locations'.declaration_handler
        vim.lsp.handlers['textDocument/typeDefinition'] = require'lsputil.locations'.typeDefinition_handler
        vim.lsp.handlers['textDocument/implementation'] = require'lsputil.locations'.implementation_handler
        vim.lsp.handlers['textDocument/documentSymbol'] = require'lsputil.symbols'.document_handler
        vim.lsp.handlers['workspace/symbol'] = require'lsputil.symbols'.workspace_handler
      end
    }
  }
  use {
    "ray-x/lsp_signature.nvim",
    config = function()
      local cfg = {
        bind = true,
        floating_window_above_cur_line = false,
        zindex = 50,
        handler_opts = {
          border = "rounded"
        }
      }
      require "lsp_signature".setup(cfg)
    end
  }
  use 'gfanto/fzf-lsp.nvim'
  use {
    'weilbith/nvim-code-action-menu',
    cmd = 'CodeActionMenu'
  } -- code action menu
  use 'windwp/nvim-autopairs' -- automatically insert pairs
  use { 'nvim-treesitter/nvim-treesitter', run = ':TSUpdate' } -- syntax highlighting
  use {
    'windwp/nvim-ts-autotag',
    config = function()
      require('nvim-ts-autotag').setup()
    end
  }

  -- search
  use { 'nvim-telescope/telescope.nvim', requires = { { 'nvim-lua/popup.nvim' }, { 'nvim-lua/plenary.nvim' } } } -- file finder
  use { 'nvim-telescope/telescope-fzf-native.nvim', run = 'cmake -S. -Bbuild -DCMAKE_BUILD_TYPE=Release && cmake --build build --config Release && cmake --install build --prefix build' }
  use { 'ThePrimeagen/harpoon' }

  -- testing
  use 'janko-m/vim-test' -- testing commands
  use { 'akinsho/toggleterm.nvim', branch = 'main' } -- terminal wrapper

  -- python
  use { 'Vimjas/vim-python-pep8-indent', ft = 'python' } -- python indenting
end }
