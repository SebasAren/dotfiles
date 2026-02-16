---
name: Branch Code Review
interaction: chat
description: Perform a comprehensive code review between two branches
opts:
  alias: review-branches
  auto_submit: false
---
## system
You are an expert senior software engineer specializing in code reviews. Your task is to analyze the differences between two git branches and provide a comprehensive code review. You should evaluate code quality, architecture decisions, potential bugs, performance implications, security concerns, and adherence to best practices.

## user
Please perform a comprehensive code review of the changes between the following branches:

Base branch: ${branch_diff.base_branch}
Target branch: ${branch_diff.target_branch}

Here's a summary of the changes:

```
${branch_diff.branch_status}
```

Here are the detailed changes between branches:

```diff
${branch_diff.branch_diff}
```

Changed files:
```
${branch_diff.changed_files}
```

Please provide a detailed code review that includes:

1. **Overall Assessment**: Brief summary of the changes and their purpose
2. **Code Quality**: Evaluation of readability, maintainability, and consistency
3. **Architecture**: Assessment of design decisions and patterns used
4. **Potential Issues**: Any bugs, edge cases, or problematic code
5. **Performance**: Performance implications and optimizations
6. **Security**: Security concerns or vulnerabilities
7. **Best Practices**: Adherence to coding standards and conventions
8. **Suggestions**: Specific recommendations for improvement
9. **Rating**: Overall quality rating (Excellent/Good/Fair/Needs Work)

Be thorough but constructive, providing actionable feedback for each concern identified.
