return {
	{
		name = "run_pytest_tests",
		description = "Runs pytest tests and returns results",
		command = "uv run pytest",
		param = { -- Input parameters (optional)
			type = "table",
			fields = {
				{
					name = "target",
					description = "Package or directory to test (e.g. './pkg/...' or './internal/pkg')",
					type = "string",
					optional = true,
				},
			},
		},
		returns = {
			{
				name = "result",
				description = "Result of the fetch",
				type = "string",
			},
			{
				name = "error",
				description = "Error message if the fetch was not successful",
				type = "string",
				optional = true,
			},
		},
		func = function(params, on_log, on_complete)
			local target = params.target or "."
			return vim.fn.system(string.format("uv run pytest %s", target))
		end,
	},
}
