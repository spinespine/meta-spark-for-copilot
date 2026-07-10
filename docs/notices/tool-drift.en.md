# Unstable Tools List

Muse Spark 1.1 for Copilot Chat detected that the Tools list in the current chat may be unstable across turns.

## Why This Happens

The Meta Chat Completions API supports at most **128 tools** in one request. VS Code's Language Model API also lets a model declare the maximum number of tools it can receive per request.

When the experimental `meta-spark-copilot.experimental.stabilizeToolList` setting is enabled, the extension tries to pre-activate VS Code/Copilot `activate_*` virtual tools before sending the request, so the Meta API `tools` parameter is more complete and stable across turns.

If too many tools are available in the current environment, Copilot may trim, group, or defer tool expansion. The resulting Tools array may differ between turns.

## Impact

Meta uses prompt caching for the input prefix. The Tools array is part of the request input; if it changes, the cache may not hit.

With this experimental setting enabled, each request may include more function definitions (names, descriptions, and JSON schemas), so **input tokens** can increase. Cache-hit input tokens are billed at a lower price but still count toward usage. It is usually unnecessary with fewer than **64 enabled tools**. Do not enable it with more than **128 enabled tools**, because Meta supports at most **128 functions** in one `tools` request.

## What You Can Do

1. Run the VS Code command `workbench.action.chat.configureTools` and disable tools or MCP tools you do not currently need.
2. Turn off `meta-spark-copilot.experimental.stabilizeToolList`.
3. If a lower cache hit rate is acceptable, you can continue sending messages in this chat.

If you have a better solution, please open an issue at [spinespine/meta-spark-for-copilot](https://github.com/spinespine/meta-spark-for-copilot/issues).
