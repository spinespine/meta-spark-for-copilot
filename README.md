# Muse Spark 1.1 for Copilot Chat

<p align="center">
  <!-- marketplace-readme:remove-start -->
  <a href="https://marketplace.visualstudio.com/items?itemName=lukespine.meta-spark-for-copilot"><img src="https://img.shields.io/badge/VS%20Code%20Marketplace-Install-007ACC?logo=visualstudiocode&logoColor=white&style=for-the-badge" alt="Install from VS Code Marketplace"></a>
  <a href="https://open-vsx.org/extension/lukespine/meta-spark-for-copilot"><img src="https://img.shields.io/badge/Open%20VSX-Install-6A4FB6?style=for-the-badge" alt="Install from Open VSX"></a>
  <br/>
  <!-- marketplace-readme:remove-end -->
  <img src="https://img.shields.io/github/v/release/spinespine/meta-spark-for-copilot?style=for-the-badge&label=Version" alt="Version" />
</p>

<p align="center">
  English |
  <a href="https://github.com/spinespine/meta-spark-for-copilot/blob/main/README.zh-cn.md">简体中文</a>
</p>

Pick **Muse Spark 1.1** from the Copilot Chat model picker — with native vision, reasoning effort control, and agent tools.

<p align="center">
  <img src="resources/screenshots/01-picker.png" alt="Muse Spark 1.1 in the Copilot Chat model picker" width="800">
</p>

## Why this extension?

- **Don't replace Copilot — power it up.** No new sidebar, no new chat UI. Just a new model in the picker you already use.
- **Agent mode, tool calling, instructions, MCP, skills — all of it still works.** Copilot's entire stack, now running on Meta Spark.
- **Native vision.** Drop screenshots, diagrams, photos into chat — Muse Spark sees them natively (up to 50 images per request, no proxy needed).
- **BYOK, pay Meta directly.** Your API key (`LLM...`), your bill, your rate limits. Stored in OS keychain via SecretStorage.

## Features

### Muse Spark 1.1 in the model picker
Single model `muse-spark-1.1` with 1,048,576 context, 131,072 max output, multimodal input (text/image/video/PDF), text output. Switch models mid-chat without losing history.

### Native Vision
Drop an image into chat and it's sent as a base64 data URL in the `image_url` content part. No proxy, no extra config.

<p align="center">
  <img src="resources/screenshots/03-vision.png" alt="Native vision with Muse Spark in Copilot Chat" width="800">
</p>

### Reasoning Effort Control
Full support for `reasoning_effort`: `minimal` (fastest), `low`, `medium` (balanced, default), `high` (deep), `xhigh` (max). Use Copilot Chat's native model picker menu to choose. Note: `none` is not supported by the Meta API and maps to `minimal`.

### Inherits Every Copilot Capability
Agent mode, tool calling (file edits, terminal, etc.), custom instructions, MCP servers, skills — all work because this extension implements `vscode.LanguageModelChatProvider`.

<p align="center">
  <img src="resources/screenshots/04-agent.png" alt="Muse Spark running Copilot Agent mode" width="800">
</p>

## Setup

### Prerequisites

- VS Code 1.116 or later
- GitHub Copilot subscription (Free / Pro / Enterprise)
- Meta API key from [dev.meta.ai](https://dev.meta.ai/) — format `LLM|...`

### Install

1. **Microsoft VS Code** — install from the [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=lukespine.meta-spark-for-copilot)
2. **Open VSX editors** — install from [Open VSX](https://open-vsx.org/extension/lukespine/meta-spark-for-copilot)

### Use

1. Command Palette (`Cmd/Ctrl+Shift+P`) → **Meta Spark: Set API Key**
2. Paste your Meta API key (`LLM...`)
3. Open Copilot Chat and pick **Muse Spark 1.1**

## Configuration

| Setting | Default | Description |
|---|---|---|
| `meta-spark-copilot.baseUrl` | `https://api.meta.ai/v1` | Meta API base URL |
| `meta-spark-copilot.maxCompletionTokens` | `0` | Max output tokens (`0` = API default) |
| `meta-spark-copilot.modelIdOverrides` | official IDs | Override API model IDs for proxies |
| `meta-spark-copilot.debugMode` | `minimal` | `minimal` / `metadata` / `verbose` diagnostics |
| `meta-spark-copilot.experimental.stabilizeToolList` | `false` | Experimental tool-list stabilization for cache hits |

## Pricing

$1.25 / 1M input, $0.15 / 1M cached input, $4.25 / 1M output. No long-context premium. See [Meta pricing](https://dev.meta.ai/docs/getting-started/pricing-rate-limits).

## Rate Limits

Free: 60 RPM / 2M TPM. Paid: 3000 RPM / 4M TPM per team. 429 responses include `Retry-After`.

## Error Handling

- `401 invalid_api_key`: check `LLM...` format
- `429 rate_limit_exceeded`: wait for `Retry-After`
- `400 content_policy_violation`: content policy
- `503 server_shutting_down`: retryable
- `504 gateway_timeout`: prefer streaming

## Development

```bash
npm install
npm run compile
# Then F5 to launch Extension Host
```

## License

[MIT](LICENSE)
