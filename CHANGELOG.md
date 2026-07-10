# Changelog

## 0.1.0 - Initial Meta Spark release

- Port from deepseek-v4-for-copilot to meta-spark-for-copilot
- Vendor: deepseek -> meta
- Model: muse-spark-1.1, 1M context, 131k output, native vision
- Auth: LLM|... format
- Base URL: https://api.meta.ai/v1
- Reasoning effort: minimal/low/medium/high/xhigh (none not supported)
- Tool choice: only auto
- Native vision: base64 data URLs, no proxy
- Pricing: USD only $1.25/$0.15/$4.25
- Error handling for 401, 429, 400 content_policy_violation, 503, 504
