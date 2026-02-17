---
name: Generate Agent Documentation
description: Create comprehensive AGENTS.md or CLAUDE.md documentation for a repository
interaction: chat
tags: [documentation, agents, repository]
opts:
  alias: generate-agent-docs
  auto_submit: false
---
## system
You are an expert technical writer specializing in AI assistant documentation. Your task is to analyze a repository and generate comprehensive AGENTS.md or CLAUDE.md documentation that follows LLM code assistant standards.

## user
Generate comprehensive AGENTS.md or CLAUDE.md documentation for this repository. Please analyze the repository structure and create documentation that includes:

## Analysis Requirements
First, gather information about the repository:

### Repository Structure Analysis
```bash
${bash.ls_la}
${bash.find_structure}
```

### Existing Documentation
```
${file.read(AGENTS.md) || "No existing AGENTS.md"}
${file.read(CLAUDE.md) || "No existing CLAUDE.md"}
${file.read(README.md) || "No existing README.md"}
```

### Key Files and Configurations
```
${bash.find_key_files}
```

## Documentation Template
Generate documentation following this structure:

### 1. Repository Overview
- **Purpose**: Clear statement of what this repository contains
- **Key Features**: Bullet list of main capabilities
- **Target Environment**: OS, tools, dependencies
- **AI Integration**: How AI tools are used in this repo

### 2. Architecture and Components
- **High-level Architecture**: Text-based diagram or description
- **Core Components**: Table of main components with descriptions
- **Dependency Graph**: Visual representation of relationships
- **Key Modules**: Important modules and their responsibilities

### 3. Setup and Installation
- **Prerequisites**: Required tools and versions
- **Installation Steps**: Numbered step-by-step guide
- **Configuration**: Customization points and files
- **Post-installation**: Additional setup requirements

### 4. Development Workflow
- **Version Control**: Branching strategy, commit conventions
- **Configuration Management**: How configs are managed
- **Update Process**: Keeping dependencies up to date
- **Testing Strategy**: How to verify changes

### 5. Essential Commands
- **Setup Commands**: Initial installation commands
- **Common Operations**: Day-to-day commands
- **Tool-specific Commands**: Editor, WM, service commands
- **AI Commands**: AI-specific operations and shortcuts

### 6. AI Integration Points
- **AI Tools Used**: List of AI frameworks and tools
- **Integration Patterns**: How AI is integrated
- **Custom Prompts**: Location and usage of custom prompts
- **Best Practices**: Guidelines for AI usage

### 7. File Structure Conventions
- **Organization**: How files are organized
- **Naming Conventions**: Rules for file naming
- **Configuration Locations**: Where configs are stored
- **Documentation Locations**: Where docs are kept

### 8. Troubleshooting Guide
- **Common Issues**: Frequently encountered problems
- **Debugging Techniques**: How to debug issues
- **Monitoring**: How to monitor services
- **Logging**: Where to find logs

### 9. Future Roadmap
- **Planned Improvements**: Upcoming enhancements
- **Migration Paths**: Upcoming changes
- **Deprecation Notices**: Soon-to-be-removed features

### 10. Important Notes
- **Security Considerations**: Security-related notes
- **Performance Tips**: Optimization suggestions
- **Customization Points**: Where to customize
- **Community Resources**: Helpful external resources

## Generation Instructions
1. Analyze the repository structure and existing documentation
2. Identify all key components, tools, and workflows
3. Generate comprehensive documentation following the template
4. Ensure all sections are populated with relevant information
5. Use markdown formatting for readability
6. Include code blocks for commands and configurations
7. Add cross-references between related sections

## Output Requirements
- Use proper markdown formatting
- Include code blocks for commands
- Use tables for structured data
- Add cross-references where appropriate
- Ensure comprehensive coverage of all aspects
- Tailor content to the specific repository
- Follow LLM code assistant documentation standards