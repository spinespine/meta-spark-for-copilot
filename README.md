# Muse Spark 1.1 for Copilot Chat

Pick **Muse Spark 1.1** from the Copilot Chat model picker — with native vision, reasoning effort control, and agent tools.

## Why this extension?

- **Don't replace Copilot — power it up.** No new sidebar, no new chat UI. Just a new model in the picker you already use.
- **Agent mode, tool calling, instructions, MCP, skills — all of it still works.** Copilot's entire stack, now running on Meta Spark.
- **Native vision.** Drop screenshots, diagrams, photos into chat — Muse Spark sees them natively (up to 50 images per request, no proxy needed).
- **BYOK, pay Meta directly.** Your API key (`LLM...`), your bill, your rate limits. Stored in OS keychain via SecretStorage.

## Features

### Muse Spark 1.1 in the model picker
Single model `muse-spark-1.1` with 1,048,576 context, 131,072 max output, multimodal input (text/image/video/PDF), text output. Switch models mid-chat without losing history.

### Native Vision
Drop an image into chat and it's sent as base64 data URL `data:{mime};base64,...` in the `image_url` content part. No proxy, no extra config. Token cost ~1300-1500 tokens for 1280px image.

### Reasoning Effort Control
Full support for `reasoning_effort`: `minimal` (fastest), `low`, `medium` (balanced, default), `high` (deep), `xhigh` (max). Use Copilot Chat's native model picker menu to choose. Note: `none` is NOT supported by Meta API — it maps to `minimal`. On Chat Completions, `reasoning_content` is redacted to empty for external callers, so thinking UI won't show (use Responses API for summaries in future).

### Inherits Every Copilot Capability
Agent mode, tool calling (file edits, terminal, etc.), custom instructions, MCP servers, skills — all work because this extension implements `vscode.LanguageModelChatProvider`.

## Setup

1. Get API key from https://dev.meta.ai/ — format `LLM...` e.g. `LLM|607358788850350|...`
2. Install extension
3. Run command `Meta Spark: Set API Key` (Command Palette)
4. Open Copilot Chat, pick `Muse Spark 1.1` from model picker

## Configuration

- `meta-spark-copilot.baseUrl`: default `https://api.meta.ai/v1`
- `meta-spark-copilot.maxCompletionTokens`: 0 = API default
- `meta-spark-copilot.modelIdOverrides`: override API model ID (e.g. for proxies)
- `meta-spark-copilot.debugMode`: minimal | metadata | verbose

## Pricing

$1.25 / 1M input, $0.15 / 1M cached input, $4.25 / 1M output. No long-context premium. See https://dev.meta.ai/docs/getting-started/pricing-rate-limits

## Rate Limits

Free: 60 RPM / 2M TPM, Paid: 3000 RPM / 4M TPM per team. 429 with Retry-After header.

## Error Handling

- 401 invalid_api_key: check LLM format
- 429 rate_limit_exceeded: shows Retry-After
- 400 content_policy_violation: content policy
- 503 server_shutting_down: retryable
- 504 gateway_timeout: use streaming

## How it works

VS Code Chat → `provideLanguageModelChatResponse(messages, options, progress, token)` → segment + classify → `convertMessages` (handles `LanguageModelDataPart` image → base64 data URL) → build `MetaRequest` with `reasoning_effort`, `tool_choice: auto`, `prompt_cache_key`, `max_completion_tokens` → `MetaClient.streamChatCompletion()` POST to `{baseUrl}/chat/completions` SSE → `progress.report(LanguageModelTextPart/ThinkingPart/ToolCallPart)` → VS Code renders.

## Development

```bash
npm install
npm run compile
# Then F5 to launch Extension Host
```

## License

MIT
