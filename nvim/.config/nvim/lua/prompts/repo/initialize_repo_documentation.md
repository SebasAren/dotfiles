---
name: Initialize Repository Documentation
interaction: chat
description: Analyze a repository and create/update AGENTS.md or CLAUDE.md with relevant information
tags: [repo, documentation, initialization]
opts:
  alias: repo-doc-init
  auto_submit: false
---
## system
You are an expert repository analyst and documentation specialist. Your task is to analyze the current repository structure, identify key components, and create or update documentation files (AGENTS.md or CLAUDE.md) that provide comprehensive guidance for AI assistants working with this codebase.

## user
Analyze the current repository and create/update documentation for AI assistants. Here's what I need:

1. **Repository Analysis**: Examine the repository structure, identify key components, tools, and workflows
2. **Documentation Creation**: Create or update AGENTS.md or CLAUDE.md with relevant information
3. **AI Assistant Guidance**: Provide specific instructions for AI tools working with this codebase

## Repository Context
- Repository path: `${repo.path}`
- Git status: `${git.status}`
- Recent commits: `${git.log}`

## Requirements
Follow these standards for LLM code assistant documentation:

### 1. Repository Overview
- Clear purpose and scope
- Key features and capabilities
- Target environment and dependencies

### 2. Architecture and Components
- High-level architecture diagram/description
- Core components and their relationships
- Key modules and their responsibilities

### 3. Setup and Installation
- Prerequisites and dependencies
- Step-by-step installation instructions
- Configuration and customization points

### 4. Development Workflow
- Version control strategy
- Configuration management approach
- Update and maintenance processes

### 5. Essential Commands
- Common operations and their commands
- Tool-specific keybindings and shortcuts
- Service management commands

### 6. AI Integration Points
- AI tools and frameworks used
- Integration patterns and best practices
- Custom prompts and their usage

### 7. Troubleshooting Guide
- Common issues and solutions
- Debugging techniques
- Monitoring and logging

## Implementation Steps
1. Analyze the repository structure using the bash tool
2. Examine existing documentation files (AGENTS.md, CLAUDE.md, README.md)
3. Identify key components, tools, and workflows
4. Create or update the documentation file with comprehensive information
5. Ensure the documentation follows LLM code assistant standards

## Expected Output
A comprehensive AGENTS.md or CLAUDE.md file that:
- Provides clear guidance for AI assistants
- Follows established documentation standards
- Includes all essential sections for repository understanding
- Uses appropriate formatting and structure
- Is tailored to the specific repository's needs

## Success Criteria
- Documentation file created/updated successfully
- All key components and workflows documented
- AI-specific guidance included
- Standards compliance verified
- File is well-structured and readable