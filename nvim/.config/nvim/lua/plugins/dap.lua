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
				desc = "Breakpoint Condition",
			},
			{
				"<leader>db",
				function()
					require("dap").toggle_breakpoint()
				end,
				desc = "Toggle Breakpoint",
			},
			{
				"<leader>dc",
				function()
					require("dap").continue()
				end,
				desc = "Run/Continue",
			},
			{
				"<leader>da",
				function()
					require("dap").continue({ before = get_args })
				end,
				desc = "Run with Args",
			},
			{
				"<leader>dC",
				function()
					require("dap").run_to_cursor()
				end,
				desc = "Run to Cursor",
			},
			{
				"<leader>dg",
				function()
					require("dap").goto_()
				end,
				desc = "Go to Line (No Execute)",
			},
			{
				"<leader>di",
				function()
					require("dap").step_into()
				end,
				desc = "Step Into",
			},
			{
				"<leader>dj",
				function()
					require("dap").down()
				end,
				desc = "Down",
			},
			{
				"<leader>dk",
				function()
					require("dap").up()
				end,
				desc = "Up",
			},
			{
				"<leader>dl",
				function()
					require("dap").run_last()
				end,
				desc = "Run Last",
			},
			{
				"<leader>do",
				function()
					require("dap").step_out()
				end,
				desc = "Step Out",
			},
			{
				"<leader>dO",
				function()
					require("dap").step_over()
				end,
				desc = "Step Over",
			},
			{
				"<leader>dP",
				function()
					require("dap").pause()
				end,
				desc = "Pause",
			},
			{
				"<leader>dr",
				function()
					require("dap").repl.toggle()
				end,
				desc = "Toggle REPL",
			},
			{
				"<leader>ds",
				function()
					require("dap").session()
				end,
				desc = "Session",
			},
			{
				"<leader>dt",
				function()
					require("dap").terminate()
				end,
				desc = "Terminate",
			},
			{
				"<leader>dw",
				function()
					require("dap.ui.widgets").hover()
				end,
				desc = "Hover variable",
			},
			{
				"<leader>dS",
				function()
					require("dap.ui.widgets").sidebar(require("dap.ui.widgets").scopes, {}, "vsplit").toggle()
				end,
				desc = "Set scopes as right pane",
			},
			{
				"<leader>du",
				function()
					require("dap.ui.widgets")
						.sidebar(require("dap.ui.widgets").frames, { height = 10 }, "belowright split")
						.toggle()
				end,
				desc = "Set frames as bottom pane",
			},
			{
				"<leader>dh",
				function()
					require("dap.repl").toggle({}, "belowright split")
				end,
				desc = "Repl split",
			},
			{
				"<leader>dv",
				function()
					require("fzf-lua").dap_variables()
				end,
			},
			{
				"<leader>df",
				function()
					require("fzf-lua").dap_frames()
				end,
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
}
