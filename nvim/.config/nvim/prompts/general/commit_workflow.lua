return {
  -- Helper function to create an execution plan based on analysis
  create_execution_plan = function(args)
    local files = args.commit.get_changed_files(args)
    
    -- Simple logic: if we have changes in different directories, split them
    -- This is a basic example - you might want more sophisticated logic
    local plan = {
      commits = {},
      current_commit = {}
    }
    
    local current_scope = nil
    
    for _, file in ipairs(files) do
      -- Extract scope from file path (e.g., "nvim/.config/nvim/" -> "nvim")
      local scope = file:match("^([^/]+)") or "other"
      
      if scope ~= current_scope then
        -- Start a new commit for this scope
        if current_scope and #plan.current_commit.files > 0 then
          table.insert(plan.commits, plan.current_commit)
        end
        
        plan.current_commit = {
          scope = scope,
          files = {file},
          message = "chore(" .. scope .. "): update configuration"
        }
        current_scope = scope
      else
        -- Add to current commit
        table.insert(plan.current_commit.files, file)
      end
    end
    
    -- Add the last commit
    if #plan.current_commit.files > 0 then
      table.insert(plan.commits, plan.current_commit)
    end
    
    return plan
  end,
  
  -- Helper function to execute the plan
  execute_plan = function(args, plan)
    local results = {}
    
    for i, commit_data in ipairs(plan.commits) do
      -- Stage files
      local add_result = args.commit.add(args, commit_data.files)
      table.insert(results, "Staging files for commit " .. i .. ": " .. add_result)
      
      -- Commit
      local commit_result = args.commit.commit(args, commit_data.message)
      table.insert(results, "Executing commit " .. i .. ": " .. commit_result)
    end
    
    return table.concat(results, "\n")
  end,
  
  -- Main workflow function
  execute_commit_workflow = function(args)
    -- Step 1: Analyze changes and create plan
    local plan = args.commit_workflow.create_execution_plan(args)
    
    -- Step 2: Format the plan for display
    local plan_text = "Commit Execution Plan:\n\n"
    for i, commit_data in ipairs(plan.commits) do
      plan_text = plan_text .. "Commit " .. i .. ":\n"
      plan_text = plan_text .. "  Message: " .. commit_data.message .. "\n"
      plan_text = plan_text .. "  Files: " .. table.concat(commit_data.files, ", ") .. "\n\n"
    end
    
    -- Step 3: Execute the plan
    local execution_results = args.commit_workflow.execute_plan(args, plan)
    
    return {
      execution_plan = plan_text,
      execution_results = execution_results
    }
  end
}