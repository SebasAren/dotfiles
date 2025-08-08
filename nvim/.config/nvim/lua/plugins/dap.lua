local js_based_languages = {
	"typescript",
	"javascript",
	"typescriptreact",
	"javascriptreact",
	"vue",
}

return {
	{
		"mfussenegger/nvim-dap",
		dependencies = {
			"williamboman/mason.nvim",
			"jay-babu/mason-nvim-dap.nvim",
		},
		keys = {
			{
				"<leader>dB",
				function()
					require("dap").set_breakpoint(vim.fn.input("Breakpoint condition: "))
				end,
				desc = "Set conditional breakpoint",
			},
			{
				"<leader>db",
				function()
					require("dap").toggle_breakpoint()
				end,
				desc = "Toggle breakpoint at current line",
			},
			{
				"<leader>dc",
				function()
					require("dap").continue()
				end,
				desc = "Start/continue debugging session",
			},
			{
				"<leader>da",
				function()
					require("dap").continue({ before = get_args })
				end,
				desc = "Continue with custom arguments",
			},
			{
				"<leader>dC",
				function()
					require("dap").run_to_cursor()
				end,
				desc = "Run to cursor position",
			},
			{
				"<leader>dg",
				function()
					require("dap").goto_()
				end,
				desc = "Go to line without executing",
			},
			{
				"<leader>di",
				function()
					require("dap").step_into()
				end,
				desc = "Step into function",
			},
			{
				"<leader>dj",
				function()
					require("dap").down()
				end,
				desc = "Move down in stack trace",
			},
			{
				"<leader>dk",
				function()
					require("dap").up()
				end,
				desc = "Move up in stack trace",
			},
			{
				"<leader>dl",
				function()
					require("dap").run_last()
				end,
				desc = "Re-run last debug session",
			},
			{
				"<leader>do",
				function()
					require("dap").step_out()
				end,
				desc = "Step out of current function",
			},
			{
				"<leader>dO",
				function()
					require("dap").step_over()
				end,
				desc = "Step over current line",
			},
			{
				"<leader>dP",
				function()
					require("dap").pause()
				end,
				desc = "Pause debug session",
			},
			{
				"<leader>dr",
				function()
					require("dap").repl.toggle()
				end,
				desc = "Toggle debug REPL",
			},
			{
				"<leader>ds",
				function()
					require("dap").session()
				end,
				desc = "Show current debug session",
			},
			{
				"<leader>dt",
				function()
					require("dap").terminate()
				end,
				desc = "Terminate debug session",
			},
			{
				"<leader>dw",
				function()
					require("dap.ui.widgets").hover()
				end,
				desc = "Hover variable under cursor",
			},
			{
				"<leader>dS",
				function()
					require("dap.ui.widgets").sidebar(require("dap.ui.widgets").scopes, {}, "vsplit").toggle()
				end,
				desc = "Toggle scopes sidebar",
			},
			{
				"<leader>dU",
				function()
					require("dap.ui.widgets")
						.sidebar(require("dap.ui.widgets").frames, { height = 10 }, "belowright split")
						.toggle()
				end,
				desc = "Toggle frames sidebar",
			},
			{
				"<leader>dh",
				function()
					require("dap.repl").toggle({}, "belowright split")
				end,
				desc = "Toggle REPL in split",
			},
			{
				"<leader>dv",
				function()
					require("fzf-lua").dap_variables()
				end,
				desc = "Search debug variables with fzf",
			},
			{
				"<leader>df",
				function()
					require("fzf-lua").dap_frames()
				end,
				desc = "Search debug frames with fzf",
			},
		},
		config = function()
			local dap = require("dap")

			dap.adapters.python = function(callback, config)
				if config.request == "launch" then
					callback({
						type = "executable",
						command = "python3",
						args = { "-m", "debugpy.adapter" },
					})
				elseif config.request == "attach" then
					local port = config.connect.port
					local host = config.connect.host

					callback({
						type = "server",
						port = port,
						host = host,
						options = {
							source_filetype = "python",
						},
					})
				end
			end

			for _, language in ipairs(js_based_languages) do
				dap.configurations[language] = {
					-- Debug single nodejs files
					{
						type = "pwa-node",
						request = "launch",
						name = "Launch file",
						program = "${file}",
						cwd = vim.fn.getcwd(),
						sourceMaps = true,
					},
					-- Debug nodejs processes (make sure to add --inspect when you run the process)
					{
						type = "pwa-node",
						request = "attach",
						name = "Attach",
						processId = require("dap.utils").pick_process,
						cwd = vim.fn.getcwd(),
						sourceMaps = true,
					},
					-- Debug web applications (client side)
					{
						type = "pwa-chrome",
						request = "launch",
						name = "Launch & Debug Chrome",
						url = function()
							local co = coroutine.running()
							return coroutine.create(function()
								vim.ui.input({
									prompt = "Enter URL: ",
									default = "http://localhost:3000",
								}, function(url)
									if url == nil or url == "" then
										return
									else
										coroutine.resume(co, url)
									end
								end)
							end)
						end,
						webRoot = vim.fn.getcwd(),
						protocol = "inspector",
						sourceMaps = true,
						userDataDir = false,
					},
					-- Divider for the launch.json derived configs
					{
						name = "----- ↓ launch.json configs ↓ -----",
						type = "",
						request = "launch",
					},
				}
			end
			dap.configurations.python = {

				{
					type = "python",
					request = "launch",
					name = "Launch a debugging session",
					program = "${file}",
					pythonPath = function()
						return "python"
					end,
				},

				{
					type = "python",
					request = "attach",
					name = "Attach a debugging session",
					connect = function()
						local host = vim.fn.input("Host: ")
						local port = tonumber(vim.fn.input("Port: "))
						return { host = host, port = port }
					end,
				},

				{
					type = "python",
					request = "launch",
					name = "Launch a debugging session with arguments",
					program = "${file}",
					args = function()
						local args_string = vim.fn.input("Arguments: ")
						local utils = require("dap.utils")
						if utils.splitstr and vim.fn.has("nvim-0.10") == 1 then
							return utils.splitstr(args_string)
						end
						return vim.split(args_string, " +")
					end,
					pythonPath = function()
						return "python"
					end,
				},
			}
			vim.fn.sign_define("DapBreakpoint", {
				text = "--",
				texthl = "DiagnosticError",
				numhl = "",
			})

			vim.fn.sign_define("DapStopped", {
				text = "->",
				texthl = "DiagnosticHint",
				numhl = "",
			})
		end,
	},
	{
		"rcarriga/nvim-dap-ui",
		dependencies = { "mfussenegger/nvim-dap", "nvim-neotest/nvim-nio" },
		keys = {
			{
				"<leader>du",
				function()
					require("dapui").toggle()
				end,
				desc = "Toggle DAP UI",
			},
			{
				"<leader>dW",
				function()
					require("dapui").elements.watches.add(vim.fn.expand("<cword>"))
				end,
				desc = "Add variable under cursor to watch list",
			},
			{
				"<leader>dE",
				function()
					require("dapui").elements.watches.add(vim.fn.input("Watch expression: "))
				end,
				desc = "Add custom expression to watch list",
			},
		},
		config = function()
			require("dapui").setup()
		end,
	},
}
