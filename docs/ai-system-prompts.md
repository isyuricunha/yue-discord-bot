# AI system prompts

AI identities and personalities are deployment configuration, not runtime-provider configuration.

## Discord assistant

Use `DISCORD_AI_SYSTEM_PROMPT_PATH` to select the system prompt used by direct Discord chat completions and the text-only Custom Provider fallback.

Default container path:

```env
DISCORD_AI_SYSTEM_PROMPT_PATH=/app/prompts/system_prompt.txt
```

The Mistral Agent keeps its own Studio instructions. The local Discord system prompt is not sent to Agent conversations.

## Panel assistant

Use `PANEL_AI_SYSTEM_PROMPT_PATH` to select the panel assistant system prompt.

Default container path:

```env
PANEL_AI_SYSTEM_PROMPT_PATH=/app/prompts/panel_ai_system_prompt.txt
```

## Customizing identity

The application does not impose a character name or persona. Define the assistant identity, name, personality, tone, and deployment-specific behavior inside the prompt files.

Templates are available at:

- `prompts/system_prompt.example.txt`
- `prompts/panel_ai_system_prompt.example.txt`

## Legacy variables

The following variables remain temporary compatibility aliases:

- `MISTRAL_PROMPT_PATH`
- `PANEL_AI_PROMPT_PATH`

The generic variables take precedence when both names are configured.
