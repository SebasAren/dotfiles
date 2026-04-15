# Session Analyzer Extension

Export pi sessions to agent-readable JSON files for analysis of agent behavior patterns. Detects common mistakes like inefficient tool usage, repeated commands, and errors.

## Features

- **Export sessions** to structured JSON format
- **Analyze agent behavior** for common mistake patterns
- **Detect issues** like repeated commands, inefficient tool usage, errors
- **Interactive UI** to view analysis results

## Commands

### `/export-session [path]`

Export the current session to a JSON file for analysis.

```bash
/export-session                    # Exports to <session-name>-analysis.json
/export-session ./analysis.json    # Exports to specified path
```

### `/analyze-session`

Show an interactive analysis of the current session, including:
- Session statistics (duration, turns, tool calls)
- Tool usage breakdown
- Detected issues with suggestions

## Tool: `session_analyze`

The LLM can use this tool to analyze sessions programmatically.

### Parameters

- `action`: `"analyze"` | `"export"` - Whether to analyze or export the session
- `exportPath`: (optional) Path to export JSON file
- `includeThinking`: (optional, default: true) Include thinking content in export
- `includeToolResults`: (optional, default: true) Include tool result content

### Example Tool Call

```json
{
  "name": "session_analyze",
  "arguments": {
    "action": "analyze"
  }
}
```

## Export Format

The exported JSON contains:

```json
{
  "meta": {
    "id": "session-uuid",
    "cwd": "/path/to/project",
    "startTime": "2024-01-01T00:00:00Z",
    "endTime": "2024-01-01T00:10:00Z",
    "durationMs": 600000,
    "entryCount": 42,
    "turnCount": 10
  },
  "turns": [
    {
      "turnIndex": 1,
      "timestamp": "2024-01-01T00:00:01Z",
      "userMessage": "List files in the project",
      "assistantText": "I'll list the files...",
      "toolCalls": [...],
      "model": "claude-sonnet-4-5",
      "provider": "anthropic",
      "usage": { "input": 1000, "output": 500, "total": 1500 }
    }
  ],
  "toolExecutions": [
    {
      "turnIndex": 1,
      "toolCallId": "call_123",
      "toolName": "bash",
      "args": { "command": "ls -la" },
      "resultSummary": "file1.txt file2.txt ...",
      "isError": false,
      "timestamp": "2024-01-01T00:00:02Z"
    }
  ],
  "issues": [
    {
      "type": "inefficient_tool",
      "severity": "info",
      "description": "2 bash commands could use dedicated tools",
      "occurrences": [...],
      "suggestion": "Prefer specialized tools over bash equivalents"
    }
  ],
  "summary": {
    "totalToolCalls": 25,
    "toolCallCounts": { "bash": 10, "read": 8, "edit": 7 },
    "errorCount": 2,
    "repeatedCommandCount": 3,
    "estimatedTokensUsed": 50000
  }
}
```

## Detected Issue Patterns

| Type | Severity | Description |
|------|----------|-------------|
| `repeated_command` | warning | Same bash command used 3+ times |
| `inefficient_tool` | info | Using bash for tasks with dedicated tools |
| `excessive_reads` | info | 5+ files read in a single turn |
| `failed_tool` | error | Tool execution failed |
| `context_bloat` | warning | High token usage (>50k per turn) |

## Use Cases

### Evaluating Codebase Setup for Agents

1. Run a session with typical agent tasks
2. Export with `/export-session`
3. Review the `issues` array for patterns:
   - Are agents using `cat` instead of `read` tool?
   - Are commands being repeated unnecessarily?
   - Are there frequent errors?

### Improving Agent Configuration

Based on analysis, you can:
- Add better tool descriptions in AGENTS.md
- Create custom aliases for common patterns
- Document preferred tools for specific tasks

### Benchmarking Agent Performance

Compare sessions over time:
- Token usage per task
- Error rates
- Tool efficiency patterns
