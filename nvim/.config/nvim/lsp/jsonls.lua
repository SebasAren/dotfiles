return {
	settings = {
		json = {
			schemas = require("schemastore").json.schemas(),
			validate = { enable = true },
			schemaDownload = { enable = true },
		},
	},
}
