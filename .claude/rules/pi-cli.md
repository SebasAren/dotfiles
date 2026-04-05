---
description: Pi CLI invocation patterns and gotchas
---

- **stdin piping = batch mode**: `pi < file` makes pi process the file as a non-interactive batch prompt and exit. To include file content while staying interactive, use `pi "@$file"` (file prefix as context).
- **Interactive mode by default**: Running `pi` without stdin piping or `--print` starts interactive mode.
- **`--print` for non-interactive**: Use `pi -p "prompt"` or `--mode json` for scripted/non-interactive use cases.
