-- Lua helper functions for commit prompt
-- This file provides the diff function used in commit.md

return {
  diff = function(args)
    -- Get the git diff for ALL changes (staged and unstaged)
    local handle = io.popen("git diff")
    local result = handle:read("*a")
    handle:close()
    
    -- If no unstaged changes, check staged changes
    if result == "" then
      local handle = io.popen("git diff --cached")
      result = handle:read("*a")
      handle:close()
    end
    
    return result
  end,

  status = function(args)
    -- Get the git status for ALL changes
    local handle = io.popen("git status --short")
    local result = handle:read("*a")
    handle:close()
    return result
  end,

  get_changed_files_formatted = function(args)
    -- Get a formatted list of ALL changed files (staged and unstaged)
    local handle = io.popen("git status --short")
    local result = handle:read("*a")
    handle:close()
    
    local files = {}
    for line in result:gmatch("[^\n]+") do
      -- Extract filename from git status line (e.g., " M file.txt" -> "file.txt")
      local filename = line:match("^..%s+(.+)")
      if filename then
        table.insert(files, filename)
      end
    end
    
    return table.concat(files, "\n")
  end,

  execute_commit = function(args)
    -- Execute git commit with the provided message
    -- This function will be called by the AI to actually commit the changes
    local commit_message = args.commit_message or ""
    
    if commit_message == "" then
      return "Error: No commit message provided"
    end
    
    -- First, stage all changes (both staged and unstaged)
    local stage_cmd = "git add -A"
    local stage_handle = io.popen(stage_cmd)
    local stage_result = stage_handle:read("*a")
    stage_handle:close()
    
    -- Then commit with the provided message
    local commit_cmd = string.format("git commit -m %q", commit_message)
    local commit_handle = io.popen(commit_cmd)
    local commit_result = commit_handle:read("*a")
    commit_handle:close()
    
    return "Successfully committed changes with message: " .. commit_message
  end
}