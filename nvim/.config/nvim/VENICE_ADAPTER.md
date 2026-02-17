# Venice AI Adapter for CodeCompanion.nvim

This document explains how to use the Venice AI adapter that has been added to CodeCompanion.nvim in this configuration.

## Setup

The Venice AI adapter has been configured as an HTTP adapter in CodeCompanion following the community standard configuration. To use it:

### 1. Set up your API key

You need to set the `OPENAI_API_KEY` environment variable (Venice uses OpenAI-compatible authentication). Add this to your shell configuration (e.g., `.zshrc`, `.bashrc`):

```bash
export OPENAI_API_KEY="your_venice_api_key_here"
```

### 2. Available Models

The adapter is configured with a comprehensive list of Venice models:
- `deepseek-coder-v2-lite` (default)
- `venice-uncensored`
- `qwen-2.5-qwq-32b`
- `qwen3-4b`
- `mistral-31-24b`
- `qwen3-235b`
- `llama-3.2-3b`
- `llama-3.3-70b`
- `llama-3.1-405b`
- `dolphin-2.9.2-qwen2-72b`
- `qwen-2.5-vl`
- `qwen-2.5-coder-32b`
- `deepseek-r1-671b`

### 3. Advanced Features

The adapter includes full parameter control:
- **Temperature**: Adjust creativity (0-2, default 0.8)
- **Max tokens**: Control response length
- **Presence penalty**: Encourage new topics (-2 to 2)
- **Frequency penalty**: Reduce repetition (-2 to 2)
- **Top-p sampling**: Control diversity (0-1, default 0.9)
- **Stop sequences**: Define completion boundaries
- **Logit bias**: Fine-tune token probabilities

### 3. Using the Venice Adapter

#### Switching to Venice Adapter

You can switch to the Venice adapter using the keybinding:
- `<leader>av` - Switch to Venice AI Adapter

#### Using in Chat

1. Open the chat buffer: `<leader>aa`
2. Switch to Venice adapter: `<leader>av`
3. Start chatting with Venice AI

#### Using Inline

1. Position cursor where you want AI assistance
2. Open inline assistant: `<leader>ai`
3. Switch to Venice adapter if needed
4. Provide your prompt

#### Web Search Feature

Venice AI supports web search functionality:
- `<leader>aw` - Toggle Venice Web Search (on/off)
- When enabled, Venice can search the web to enhance responses
- Status notifications show current web search state

### 4. Configuration Details

The adapter extends the `openai_compatible` adapter with comprehensive configuration:

```lua
venice = function()
    return require("codecompanion.adapters").extend("openai_compatible", {
        name = "venice",
        formatted_name = "Venice",
        roles = {
            llm = "assistant",
            user = "user",
        },
        opts = {
            stream = true,
        },
        features = {
            text = true,
            tokens = true,
            vision = false,
        },
        env = {
            url = "https://api.venice.ai/api",
            chat_url = "/v1/chat/completions",
        },
        schema = {
            model = {
                default = "deepseek-coder-v2-lite",
                choices = {
                    "venice-uncensored",
                    "qwen-2.5-qwq-32b",
                    "qwen3-4b",
                    "mistral-31-24b",
                    "qwen3-235b",
                    "llama-3.2-3b",
                    "llama-3.3-70b",
                    "llama-3.1-405b",
                    "dolphin-2.9.2-qwen2-72b",
                    "qwen-2.5-vl",
                    "qwen-2.5-coder-32b",
                    "deepseek-r1-671b",
                    "deepseek-coder-v2-lite",
                },
            },
            -- Full parameter schema with validation
            temperature = { /* ... */ },
            max_completion_tokens = { /* ... */ },
            presence_penalty = { /* ... */ },
            top_p = { /* ... */ },
            stop = { /* ... */ },
            frequency_penalty = { /* ... */ },
            logit_bias = { /* ... */ },
        },
    })
end
```

### 4. Configuration Details

The adapter extends the `openai_compatible` adapter with the following configuration:

```lua
venice = function()
    return require("codecompanion.adapters").extend("openai_compatible", {
        env = {
            url = "https://api.venice.ai",
            api_key = "VENICE_API_KEY",
        },
        headers = {
            ["Content-Type"] = "application/json",
            ["Authorization"] = "Bearer ${api_key}",
        },
        schema = {
            model = {
                default = "venice-uncensored",
                choices = {
                    "venice-uncensored",
                    "venice-uncensored-128k",
                    "venice-uncensored-200k",
                },
            },
        },
    })
end
```

### 5. Troubleshooting

#### API Key Issues

If you get authentication errors:
- Verify your `VENICE_API_KEY` environment variable is set correctly
- Restart your terminal/shell after setting the variable
- Check that the key is valid in your Venice.ai account

#### Adapter Not Showing

If the Venice adapter doesn't appear in the adapter selection:
- Ensure CodeCompanion is properly installed: `:Lazy sync`
- Check for errors in `:messages`
- Verify the configuration was loaded correctly

#### Model Selection

If you want to change the default model or add more models, edit the configuration in:
`nvim/.config/nvim/lua/plugins/acp.lua`

### 6. Customization

You can customize the Venice adapter by modifying the configuration in the `acp.lua` file. Common customizations include:

- Adding more models to the `choices` table
- Changing the default model
- Adjusting temperature or other parameters
- Adding custom headers or parameters

### 7. Keybindings Reference

| Keybinding | Description |
|------------|-------------|
| `<leader>av` | Switch to Venice AI Adapter |
| `<leader>aw` | Toggle Venice Web Search |
| `<leader>aa` | Toggle AI Chat buffer |
| `<leader>ai` | Open inline AI assistant |
| `<leader>ap` | Open action palette |
| `<leader>ac` | Add selected text to chat (visual mode) |

### 8. Web Search Customization

The web search feature can be further customized by modifying the `venice_parameters` in the adapter schema:

```lua
venice_parameters = {
    order = 10,
    mapping = "parameters",
    type = "object",
    optional = true,
    default = {
        disable_thinking = true,  -- Set to false to enable thinking
        enable_web_search = 'on',  -- 'on' or 'off'
    },
    desc = "Options to enable web search and disable think",
}
```

### 9. Community Resources

This configuration is based on the community discussion at:
https://github.com/olimorris/codecompanion.nvim/discussions/972

For additional Venice AI features and updates, check the official Venice.ai documentation and community forums.

## API Reference

The Venice AI API follows the OpenAI-compatible format:

```bash
curl https://api.venice.ai/api/v1/chat/completions \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"model": "venice-uncensored", "messages": [{"role": "user", "content": "Hello!"}]}'
```

For more information about Venice AI, visit their official documentation.