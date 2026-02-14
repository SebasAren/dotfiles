return {
  diff = function(args)
    -- Get the git diff for staged changes
    local handle = io.popen("git diff --no-ext-diff --staged 2>/dev/null")
    local result = handle:read("*a")
    handle:close()
    
    -- If no staged changes, get all changes
    if result == "" then
      local handle = io.popen("git diff --no-ext-diff 2>/dev/null")
      result = handle:read("*a")
      handle:close()
    end
    
    return result
  end,
  
  status = function(args)
    -- Get the git status
    local handle = io.popen("git status --short 2>/dev/null")
    local result = handle:read("*a")
    handle:close()
    return result
  end,
  
  commit = function(args, commit_message)
    -- Execute git commit with the provided message
    local command = string.format("git commit -m \"%s\" 2>&1", commit_message)
    local handle = io.popen(command)
    local result = handle:read("*a")
    handle:close()
    return result
  end,
  
  add = function(args, files)
    -- Stage files for commit
    if not files or #files == 0 then
      -- Add all changes if no specific files provided
      local handle = io.popen("git add -A 2>&1")
      local result = handle:read("*a")
      handle:close()
      return result
    else
      -- Add specific files
      local files_str = table.concat(files, " ")
      local command = string.format("git add %s 2>&1", files_str)
      local handle = io.popen(command)
      local result = handle:read("*a")
      handle:close()
      return result
    end
  end,
  
  get_changed_files = function(args)
    -- Get list of changed files
    local handle = io.popen("git status --short 2>/dev/null")
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
    
    return files
  end,
  
  get_changed_files_formatted = function(args)
    -- Get formatted list of changed files for display
    local files = args.commit.get_changed_files(args)
    
    if #files == 0 then
      return "No changed files found."
    end
    
    -- Format files with bullet points
    local formatted = {}
    for i, file in ipairs(files) do
      table.insert(formatted, "• " .. file)
    end
    
    return table.concat(formatted, "\n")
  end
}
