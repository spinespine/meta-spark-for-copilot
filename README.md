# Muse Spark 1.1 for Copilot Chat

<!-- marketplace-readme:remove-start -->
[VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=LukeSpine.meta-spark-for-copilot) · [Open VSX](https://open-vsx.org/extension/LukeSpine/meta-spark-for-copilot) · [Releases](https://github.com/spinespine/meta-spark-for-copilot/releases)
<!-- marketplace-readme:remove-end -->

Adds **Muse Spark 1.1** to the Copilot Chat model picker. Uses your Meta API key (BYOK).

## Features

- Model: `muse-spark-1.1` (1,048,576 context, 131,072 max output)
- Multimodal input: text, image, video, PDF
- Native vision via base64 `image_url` content parts (no proxy)
- Reasoning effort: `minimal`, `low`, `medium` (default), `high`, `xhigh`
- Works with Copilot agent mode, tools, instructions, MCP, and skills via `LanguageModelChatProvider`

## Requirements

- VS Code 1.116+
- GitHub Copilot (Free, Pro, or Enterprise)
- Meta API key from [dev.meta.ai](https://dev.meta.ai/) (`LLM|...`)

## Install

1. Install from the [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=LukeSpine.meta-spark-for-copilot) or [Open VSX](https://open-vsx.org/extension/LukeSpine/meta-spark-for-copilot)
2. Command Palette → **Meta Spark: Set API Key**
3. Open Copilot Chat and select **Muse Spark 1.1**

## Configuration

| Setting | Default | Description |
|---|---|---|
| `meta-spark-copilot.baseUrl` | `https://api.meta.ai/v1` | API base URL |
| `meta-spark-copilot.maxCompletionTokens` | `0` | Max output tokens (`0` = API default) |
| `meta-spark-copilot.modelIdOverrides` | official IDs | Override model IDs for proxies |
| `meta-spark-copilot.debugMode` | `minimal` | `minimal` / `metadata` / `verbose` |
| `meta-spark-copilot.experimental.stabilizeToolList` | `false` | Experimental tool-list stabilization |

## Pricing and limits

- Pricing: $1.25 / 1M input, $0.15 / 1M cached input, $4.25 / 1M output  
  See [Meta pricing](https://dev.meta.ai/docs/getting-started/pricing-rate-limits)
- Free tier: 60 RPM / 2M TPM
- Paid: 3000 RPM / 4M TPM per team

## Common errors

| Code | Meaning |
|---|---|
| `401 invalid_api_key` | Check key format (`LLM\|...`) |
| `429 rate_limit_exceeded` | Wait for `Retry-After` |
| `400 content_policy_violation` | Content blocked by policy |
| `503` / `504` | Transient server/gateway issue; retry |

## Development

```bash
npm install
npm run compile
```

Press `F5` to launch the Extension Host.

## License

[MIT](LICENSE)
