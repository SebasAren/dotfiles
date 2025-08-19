local provider_setup, providers = pcall(function()
	return require("plugins.llms.parrot")
end)

return provider_setup
		and {
			{
				"frankroeder/parrot.nvim",
				dependencies = { "ibhagwan/fzf-lua", "nvim-lua/plenary.nvim" },
				event = "VeryLazy",
				opts = {
					providers = providers,
					hooks = {
						Complete = function(prt, params)
							local template = [[
              I have the following code from {{filename}}:

              ```{{filetype}}
              {{selection}}
              ```

              Please finish the code above carefully and logically.
              Respond just with the snippet of code that should be inserted."
              ]]
							local model_obj = prt.get_model("command")
							prt.Prompt(params, prt.ui.Target.append, model_obj, nil, template)
						end,
						CompleteFullContext = function(prt, params)
							local template = [[
              I have the following code from {{filename}}:

              ```{{filetype}}
              {{filecontent}}
              ```

              Please look at the following section specifically:
              ```{{filetype}}
              {{selection}}
              ```

              Please finish the code above carefully and logically.
              Respond just with the snippet of code that should be inserted.
              ]]
							local model_obj = prt.get_model("command")
							prt.Prompt(params, prt.ui.Target.append, model_obj, nil, template)
						end,
						CompleteMultiContext = function(prt, params)
							local template = [[
              I have the following code from {{filename}} and other related files:

              ```{{filetype}}
              {{multifilecontent}}
              ```

              Please look at the following section specifically:
              ```{{filetype}}
              {{selection}}
              ```

              Please finish the code above carefully and logically.
              Respond just with the snippet of code that should be inserted.
              ]]
							local model_obj = prt.get_model("command")
							prt.Prompt(params, prt.ui.Target.append, model_obj, nil, template)
						end,
					},
					prompts = {
						["Debug"] = [[
                Add comprehensive debug statements to the provided code snippet.
                Include variable value logging at key points, function entry/exit logging, error condition checks with
                appropriate error messages, and execution flow tracing. Ensure the debug output is clear and informative
                for troubleshooting purposes.
              ]],
						["Comments"] = [[
                Add comprehensive comments and documentation to the following code snippet.
                Include function purpose descriptions, detailed parameter explanations, return value documentation,
                algorithm explanations where necessary, and any important implementation notes. Follow a consistent
                documentation style throughout.
              ]],
						["Optimize"] = [[
                Optimize the provided code snippet for better performance.
                Identify bottlenecks, inefficient algorithms, unnecessary computations, or memory issues.
                Provide an optimized version of the code while maintaining the same functionality and readability.
              ]],
						["Refactor"] = [[
                Refactor the provided code snippet to improve its structure, readability, and maintainability.
                Apply appropriate design patterns, eliminate code duplication, improve naming conventions, and ensure
                the code follows best practices.
              ]],
						["Explain"] = [[
                Explain what the provided code snippet does in detail.
                Describe the algorithm, data structures used, overall purpose, and how different parts of the code work
                together. Provide a clear and comprehensive explanation that would be understandable to another
                developer.
              ]],
						["Security"] = [[
                Analyze the provided code snippet for security vulnerabilities.
                Identify potential issues such as injection attacks, improper input validation, insecure data handling,
                or other security risks. Provide a more secure version of the code with explanations of the changes.
              ]],
					},
				},
			},
		}
	or {}
