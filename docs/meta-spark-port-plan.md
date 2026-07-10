# Porting DeepSeek V4 for Copilot → Meta Muse Spark 1.1 for Copilot

## 1. Current Architecture (DeepSeek extension)

**Purpose:** Expose DeepSeek models in VS Code's native Copilot Chat model picker via `vscode.lm.registerLanguageModelChatProvider`.

**Key files:**
- `package.json`: contributes `languageModelChatProviders: [{vendor: "deepseek"}]`, commands `deepseek-copilot.setApiKey`, config `deepseek-copilot.*`
- `src/consts.ts`: `CONFIG_SECTION`, `API_KEY_SECRET`, `MODELS` array (flash/pro), pricing, capabilities
- `src/config.ts`: `getBaseUrl()` default `https://api.deepseek.com`, `getApiModelId()`, `getMaxTokens()`, debug modes
- `src/auth.ts`: SecretStorage key `deepseek-copilot.apiKey`, fallback to settings, input box prompt
- `src/endpoint.ts`: `isOfficialDeepSeekBaseUrl()` checks `api.deepseek.com`
- `src/types.ts`: `DeepSeekMessage`, `DeepSeekTool`, `DeepSeekRequest` (with `thinking: {type}` + `reasoning_effort: high|max`), `DeepSeekStreamChunk` (delta.reasoning_content), `DeepSeekUsage` (prompt_cache_hit/miss)
- `src/client/core.ts`: `DeepSeekClient.streamChatCompletion()` → `POST {baseUrl}/chat/completions` with `stream_options: {include_usage:true}`, SSE parsing, accumulates `tool_calls` by index, callbacks `onContent`, `onThinking`, `onToolCall`, `onUsage`, `onDone`
- `src/client/error/`: `DeepSeekRequestError`, `createHttpError`, `normalizeRequestError`, network error handling
- `src/provider/index.ts`: `DeepSeekChatProvider implements vscode.LanguageModelChatProvider`, `provideLanguageModelChatInformation()` returns `MODELS.map(toChatInfo)`, `provideLanguageModelChatResponse()` → `resolveConversationSegment` → `classifyProviderRequest` → `prepareChatRequest` → `processToolFlow` → `streamChatCompletion`
- `src/provider/convert.ts`: VS Code `LanguageModelChatRequestMessage` → DeepSeek messages. Handles `LanguageModelTextPart`, `LanguageModelThinkingPart`, `ToolCallPart`, `ToolResultPart`. Injects replay marker `reasoning_content`. `convertTools()` → DeepSeek tool format. `countMessageChars()` for token estimation calibration.
- `src/provider/request.ts`: `prepareChatRequest()` → gets API key, baseUrl, modelDef, resolves vision via `resolveImageMessages()`, converts messages, prepares tools, builds `DeepSeekRequest` with `thinking` + `reasoning_effort`, dumps diagnostics
- `src/provider/stream.ts`: Maps client callbacks to VS Code `progress.report(new vscode.LanguageModelTextPart/ThinkingPart/ToolCallPart)`, handles replay markers, usage reporting, chars-per-token calibration
- `src/provider/models.ts`: `toChatInfo()` builds `ModelPickerChatInformation` with cost, `isBYOK`, `statusIcon`, `configurationSchema` for reasoning effort (none/high/max). `getConfiguredThinkingEffort()` reads `modelConfiguration.reasoningEffort`
- `src/provider/routing/classifier.ts`: Classifies request kind (main-agent, todo-tracker, etc.) to force `thinking: none` for helper requests on official API
- `src/provider/tools/`: `prepareRequestTools()` enforces tool limit, `flow.ts` handles preflight tool stabilization, `notices.ts` creates notices
- `src/provider/vision/`: **Critical** – DeepSeek V4 is text-only. `resolveImageMessages()` finds current user image message, calls `VisionDescriber` (either VS Code LM fallback or custom API endpoint) to describe images, replaces image parts with text description + marker for replay. Stats tracked.
- `src/provider/debug/`, `replay/`, `segment.ts`, `tokens.ts`, `pricing/`: diagnostics, replay markers, segment IDs, token estimation, cost display
- `src/runtime/`: `lifecycle.ts` activate/deactivate, `provider.ts` registers provider + commands, `commands.ts`, `actions.ts`, `welcome.ts`

**Data flow:**
VS Code Chat → `provideLanguageModelChatResponse(messages, options, progress, token)` → segment + classify → vision resolve (proxy) → convert → build request → client.stream → progress.report → VS Code renders.

## 2. Meta Muse Spark 1.1 API Spec (from https://dev.meta.ai/docs/)

**Base URL:** `https://api.meta.ai/v1`
**Model ID:** `muse-spark-1.1` (single model, 1,048,576 context, 131072 max output)
**Auth:** `Authorization: Bearer $MODEL_API_KEY`, key format `LLM|{numeric_id}|{secret}` e.g. `LLM|607358788850350|...`
**Endpoints:**
- `POST /v1/chat/completions` – OpenAI-compatible, simplest for this extension. Accepts `model`, `messages[]`, `stream`, `reasoning_effort`, `tools`, `tool_choice`, `max_completion_tokens`, `temperature`, `top_p`, `prompt_cache_key`, `stream_options: {include_usage:true}`
- `POST /v1/responses` – Full feature set, preserves reasoning across turns via encrypted `reasoning` items or `previous_response_id`, supports `reasoning.effort`, `reasoning.summary`, `include: ["reasoning.encrypted_content"]`, `input` as typed array, `function_call`/`function_call_output` items, `phase: commentary|final_answer`

**Reasoning:**
- Param: `reasoning_effort` (chat) or `reasoning.effort` (responses): `none`, `minimal`, `low`, `medium`, `high`, `xhigh`
- **Muse Spark does NOT support `none`** → returns 400. Must use minimal..xhigh. Default is model-determined if omitted.
- Chat Completions: `reasoning_content` field is **redacted to empty for external callers** (only internal callers with `internal:private_cot` see it). So thinking UI won't show unless using Responses API with `reasoning.summary`.
- Responses API: reasoning is private, but you can request summary via `reasoning.summary: auto|concise|detailed` → streams as `response.reasoning_summary_text.delta`. Raw reasoning available only as encrypted content for replay.

**Tool Calling:**
- Chat Completions: `tools: [{type:"function", function:{name, description, parameters:{type:object, properties, required, additionalProperties:false}}}]`, returns `choices[0].message.tool_calls[]` with `id`, `type:function`, `function:{name, arguments: JSON string}`, `finish_reason: tool_calls`. Follow with `tool` messages containing `tool_call_id` + result.
- Responses API: flat tool defs `{type:function, name, description, parameters}`, returns `function_call` items in `output[]`, results via `function_call_output` with `call_id`.
- **Constraints:** `tool_choice` must be `"auto"` only – `none`, `required`, named choices return 400. `parallel_tool_calls` defaults true. Function names regex `^[a-zA-Z0-9_.-]+$` max one dot. `call_id` 1-64 chars. `stop`, `n>1`, `logit_bias`, `verbosity`, `logprobs:true` not supported → 400.

**Vision (Native!):**
- Input modalities: text, image, video, PDF. Output: text.
- Chat Completions: `messages[].content[]` can be `{type:text, text}` or `{type:image_url, image_url:{url: https://... or data:image/jpeg;base64,...}}`. Up to 50 images per request, 50MB inline, 1GiB via Files API.
- Responses API: `input_image` blocks with `image_url` string or `file_id`, or `input_file` with `file_id` or `file_url`.
- Only in `user` role messages.
- Token cost scales with resolution (~1300-1500 tokens for 1280px image).

**Pricing:** $1.25 / 1M input, $0.15 / 1M cached input, $4.25 / 1M output. No long-context premium. Web search $2.50/1k queries.
**Rate Limits:** Free 60 RPM / 2M TPM, Paid 3000 RPM / 4M TPM, per team. Background submissions 600/min. Headers `x-ratelimit-limit-tokens`, `x-ratelimit-remaining-tokens`, etc. 429 with Retry-After.
**Errors:** JSON `{error:{message, type: invalid_request_error|authentication_error|rate_limit_error|server_error|billing_error, param, code: invalid_api_key|model_not_found|file_not_found|rate_limit_exceeded|server_shutting_down|payload_too_large|gateway_timeout|content_policy_violation}}`. 404 on unknown path returns empty body. Streaming errors via `response.failed` or `error` SSE events.
**Prompt Caching:** Automatic prefix caching, no flag needed. Usage reports `prompt_tokens_details.cached_tokens` (chat) or `input_tokens_details.cached_tokens` (responses). Optional `prompt_cache_key` stable string to improve hit rate, `prompt_cache_retention: in_memory|24h` on Responses.
**Other:** `max_completion_tokens` (or deprecated `max_tokens`) shares context window with input. `temperature` default 1.0, `top_p` default 1.0 – tuned to defaults, prefer clearer instructions over lowering temp. `seed` best-effort deterministic.

## 3. Delta – What Must Change

| Area | DeepSeek | Meta Spark | Action |
|------|----------|------------|--------|
| Vendor | `deepseek` | `meta` or `meta-ai` | Change `languageModelChatProviders` vendor, `lm.selectChatModels({vendor})` |
| Config section | `deepseek-copilot` | `meta-spark-copilot` or `llama-spark-copilot` | Rename everywhere, update `package.json` contributes.configuration |
| Secret key | `deepseek-copilot.apiKey` | `meta-spark.apiKey` or `meta-copilot.apiKey` | Update `API_KEY_SECRET` |
| Base URL | `https://api.deepseek.com` | `https://api.meta.ai/v1` | Default in config |
| Model registry | 2 models flash/pro, 655k input, thinking true, tool limit | 1 model `muse-spark-1.1`, 1M input, 131k output, native vision true, reasoning minimal..xhigh | Rewrite `MODELS` array, pricing USD only, capabilities imageInput true native |
| Auth validation | `sk-` prefix | `LLM|` prefix, 2 pipes | Update prompt, placeholder, validation |
| Request type | `DeepSeekRequest` with `thinking: {type}` + `reasoning_effort: high|max` | `MetaRequest` with `reasoning_effort: minimal|low|medium|high|xhigh`, `max_completion_tokens`, `prompt_cache_key` | Rewrite `types.ts` |
| Message conversion | Text-only, image parts dropped & proxied | Native image support: convert `LanguageModelDataPart` → base64 data URL `data:{mime};base64,{b64}` → `image_url` content part | Rewrite `convert.ts` to handle `content` as string OR array of `text`/`image_url` parts |
| Vision | Proxy required, complex `vision/` folder with VS Code LM + endpoint sources, marker replay | Native, no proxy needed. Can delete or keep as optional fallback. Simplest: rewrite `resolveImageMessages` to passthrough images as base64, keep stats but no describer | Major simplification: remove `vision/service.ts` describer logic, or keep but default to native |
| Streaming | `delta.reasoning_content`, `delta.content`, `delta.tool_calls`, `usage.prompt_tokens` etc | `delta.content`, `delta.tool_calls`, `delta.reasoning_content` will be empty for external callers. Usage: `prompt_tokens`, `completion_tokens`, `prompt_tokens_details.cached_tokens`, `completion_tokens_details.reasoning_tokens` | Update `client/core.ts` SSE parsing, `stream.ts` thinking handling (check if empty, skip), usage mapping |
| Tool choice | `auto`/`none`/`required` | Only `auto` allowed | Enforce `tool_choice: auto` when tools present, never send `none`/`required` |
| Thinking config | `none|high|max`, default high, UI dropdown | `minimal|low|medium|high|xhigh`, default medium, none not supported | Update `models.ts` `buildThinkingEffortSchema()` enum, labels, descriptions, `getConfiguredThinkingEffort()` |
| Pricing | USD + CNY, cache hit/miss | USD only, input/cached/output, no CNY | Update `pricing/` and `consts.ts` |
| Error handling | DeepSeek-specific messages, links to platform.deepseek.com | Meta error format, links to dev.meta.ai, handle `content_policy_violation`, `server_shutting_down` retryable | Update `client/error/` |
| Endpoint check | `isOfficialDeepSeekBaseUrl()` checks `api.deepseek.com` | `isOfficialMetaBaseUrl()` checks `api.meta.ai` | Update `endpoint.ts` |
| Commands | `deepseek-copilot.setApiKey` etc | `meta-spark.setApiKey` etc | Update `package.json` commands, `runtime/provider.ts`, `runtime/commands.ts` |
| i18n | DeepSeek strings | Meta strings | Update `package.nls.json`, `package.nls.zh-cn.json`, `src/i18n.ts` |
| Docs | DeepSeek README | Meta README | Rewrite |
| Optional Responses API | Not used | Could be future enhancement for reasoning summaries + encrypted replay | Document as phase 2 |

## 4. Implementation Plan (Phased)

**Phase 0 – Scaffolding:**
1. Copy repo to new folder `meta-spark-for-copilot` or `llama-spark-for-copilot`
2. `npm install`, verify `npm run compile` works
3. Rename package: `name`, `displayName`, `description`, `publisher`, `icon`, `repository` in `package.json`
4. Update `vscode.proposed.languageModelThinkingPart.d.ts` if needed (keep)

**Phase 1 – Core Renaming (mechanical):**
5. Global search/replace `deepseek-copilot` → `meta-spark-copilot` (or chosen id), `deepseek` vendor → `meta`, `DeepSeek` class names → `Meta`, `DEEPSEEK_` constants → `META_`
6. Update `src/consts.ts`: `CONFIG_SECTION`, `API_KEY_SECRET`, `WELCOME_SHOWN_KEY`, `EXTERNAL_URLS` (api keys url → https://dev.meta.ai/, usage → dashboard), `MODELS` array:
```ts
{
  id: 'muse-spark-1.1',
  name: 'Muse Spark 1.1',
  family: 'meta',
  version: '1.1',
  detail: 'Agentic coding, 1M context, native vision',
  maxInputTokens: 1048576,
  maxOutputTokens: 131072,
  capabilities: { toolCalling: true, imageInput: true, thinking: true },
  requiresThinkingParam: false,
  pricing: { USD: { input: 1.25, cachedInput: 0.15, output: 4.25 } },
  priceCategory: 'low'
}
```
7. Update `src/config.ts`: default baseUrl `https://api.meta.ai/v1`, `getApiModelId` still works, `getMaxTokens` → `getMaxCompletionTokens` or keep but map to `max_completion_tokens`
8. Update `src/endpoint.ts`: `OFFICIAL_META_API_HOST = 'api.meta.ai'`, `isOfficialMetaBaseUrl()`
9. Update `src/auth.ts`: prompt text "Enter your Meta API key (LLM|...)", placeholder "LLM|...", validation checks startsWith "LLM|" and contains 2 pipes

**Phase 2 – Types & Client:**
10. Rewrite `src/types.ts`: `MetaMessage` with `role: system|developer|user|assistant|tool`, `content: string | Array<{type:text|image_url, text?, image_url:{url}}>` , `MetaTool`, `MetaRequest` with `reasoning_effort`, `max_completion_tokens`, `prompt_cache_key`, `stream_options`, `MetaStreamChunk` with `choices[].delta: {role?, content?, tool_calls?, reasoning_content?}`, `MetaUsage` with `prompt_tokens`, `completion_tokens`, `total_tokens`, `prompt_tokens_details:{cached_tokens}`, `completion_tokens_details:{reasoning_tokens}`
11. Rewrite `src/client/core.ts`: keep fetch logic, change URL to `${baseUrl}/chat/completions`, keep `stream_options: {include_usage:true}`, update error creation to use Meta error format, keep tool call accumulation by index
12. Update `src/client/error/`: rename `DeepSeekRequestError` → `MetaRequestError`, update user messages, handle 429 Retry-After, 503 server_shutting_down retryable, 400 content_policy_violation

**Phase 3 – Provider Logic:**
13. Update `src/provider/convert.ts`:
- `convertMessages()` must now handle image parts: if message has `LanguageModelDataPart` with image mime, convert to `content: [{type:text, text: ...}, {type:image_url, image_url:{url: dataUrl}}]`. Need helper `dataPartToBase64DataUrl(part)` using Buffer.from(part.data).toString('base64')
- Map VS Code roles: User→user, Assistant→assistant, System (role 3) → developer (preferred) or system. Use `LANGUAGE_MODEL_CHAT_SYSTEM_ROLE` → map to `developer`
- Tool calls/results same as before
- `convertTools()` same but ensure `additionalProperties:false` if needed
- `countMessageChars()` needs to handle array content
14. Update `src/provider/request.ts`:
- Build `MetaRequest` not DeepSeekRequest
- Get `reasoning_effort` from config (minimal/low/medium/high/xhigh), default medium
- Map old `none` → `minimal` (since none not supported) or throw user-friendly error
- Set `tool_choice: tools?.length ? 'auto' : undefined` (never none/required)
- Set `max_completion_tokens` from config
- Optional `prompt_cache_key: "vscode-copilot-meta-spark"` stable key for better cache hits
- Remove `thinking` field
- Keep vision resolution but now native: either bypass or simplify
15. Update `src/provider/stream.ts`:
- `onThinking` may never fire for external callers (reasoning_content empty). Keep handler but if empty skip. Optionally log that thinking is not exposed on Chat Completions, suggest Responses API for summaries
- `onContent`, `onToolCall` same
- `onUsage`: map `prompt_tokens_details.cached_tokens` and `completion_tokens_details.reasoning_tokens` to diagnostics, update chars-per-token calibration
16. Update `src/provider/models.ts`:
- `ThinkingEffort = 'minimal'|'low'|'medium'|'high'|'xhigh'`
- `buildThinkingEffortSchema()` enum with 5 values, labels, descriptions, default medium
- `getConfiguredThinkingEffort()` reads config, maps legacy none→minimal
- `toChatInfo()` same but with Meta pricing
17. Update `src/provider/routing/classifier.ts`: keep classification, but `shouldForceThinkingNone` → `shouldForceMinimalThinking` since none not supported. For helper requests (todo-tracker etc), force `minimal` not `none`
18. Update `src/provider/tools/request.ts`: enforce tool_choice auto, remove tool limit or set high (e.g., 128)

**Phase 4 – Vision Simplification:**
19. Rewrite `src/provider/vision/resolve.ts`:
- Since native vision, don't proxy. Instead, keep image parts in messages, convert to base64 data URLs in `convert.ts`
- Simplify to: if input has images, keep them, no describer needed. Return messages unchanged, stats with input counts
- Optionally keep old proxy as fallback behind config `visionProxy.enabled` but default off
- Update `src/provider/vision/types.ts`: `VisionResolutionResult` still needed but `visionModelId` optional
- Update `src/provider/vision/service.ts`: return undefined describer, or keep but not used
- Or delete entire `vision/` folder and inline logic in `convert.ts` – but keep folder for minimal diff: make `createVisionService` return no-op

**Phase 5 – Runtime & Config:**
20. Update `src/runtime/provider.ts`: register `vscode.lm.registerLanguageModelChatProvider('meta', provider)`, commands `meta-spark.setApiKey` etc
21. Update `src/runtime/commands.ts`, `actions.ts`, `lifecycle.ts`: command IDs, log messages
22. Update `package.json`: `languageModelChatProviders: [{vendor:"meta", displayName:"Meta"}]`, commands, configuration properties: `meta-spark.baseUrl`, `maxTokens` → `maxCompletionTokens`, `modelIdOverrides`, `visionModel` (remove or keep deprecated), `debugMode`, etc.
23. Update `package.nls.json` and `zh-cn`: all `deepseek-copilot.*` keys → `meta-spark.*`
24. Update `src/i18n.ts` if needed

**Phase 6 – Testing & Polish:**
25. `npm run compile`, fix TS errors
26. Test manually: set API key `LLM|...`, open Copilot Chat, pick Muse Spark 1.1, test:
- Simple chat
- Streaming
- Tool calling (agent mode, edit file)
- Image input (drop screenshot)
- Reasoning effort switching (minimal..xhigh)
- Rate limit handling (429)
- Error handling (invalid key, 400)
27. Test token usage reporting, cache diagnostics
28. Update README.md, CHANGELOG.md, LICENSE, screenshots
29. Publish to marketplace (optional)

**Phase 7 – Optional Responses API Enhancement (Future):**
30. Add config `useResponsesApi: boolean` default false
31. If true, use `POST /v1/responses` with `input` array, `reasoning: {effort, summary:"auto"}`, `include: ["reasoning.encrypted_content"]`, handle `response.output_text.delta`, `response.reasoning_summary_text.delta`, `function_call` items, encrypted reasoning replay across turns
32. This would enable thinking UI via reasoning summaries

## 5. Risks & Mitigations

- **Thinking not visible on Chat Completions:** Document limitation, propose Responses API phase 2. For now, don't emit thinking parts, or emit placeholder notice.
- **tool_choice only auto:** Ensure never send none/required. If VS Code sends tool_choice, override to auto.
- **Image size:** Base64 encoding increases size ~33%. Need to handle large images, maybe warn if >50MB. Convert Uint8Array → base64 efficiently.
- **Context window:** 1M tokens, but need to ensure we don't send too much. Keep existing segment logic.
- **API key format:** Validate LLM| format, give clear error if user pastes DeepSeek key.
- **Vendor collision:** If another extension uses vendor "meta", pick "meta-ai" or "llama" to avoid collision. Check marketplace.
- **VS Code API stability:** Extension uses non-public `configurationSchema` for thinking effort – may break on VS Code updates. Keep same pattern as DeepSeek extension.

## 6. File Change Checklist

- [ ] package.json
- [ ] package.nls.json, package.nls.zh-cn.json
- [ ] tsconfig.json (if needed)
- [ ] src/consts.ts
- [ ] src/config.ts
- [ ] src/auth.ts
- [ ] src/endpoint.ts
- [ ] src/types.ts
- [ ] src/client/core.ts, index.ts, error/*
- [ ] src/provider/index.ts
- [ ] src/provider/convert.ts
- [ ] src/provider/request.ts
- [ ] src/provider/stream.ts
- [ ] src/provider/models.ts
- [ ] src/provider/routing/classifier.ts, index.ts
- [ ] src/provider/tools/*
- [ ] src/provider/vision/* (simplify)
- [ ] src/provider/debug/*, replay/*, segment.ts, tokens.ts, pricing/*
- [ ] src/runtime/*
- [ ] src/i18n.ts, logger.ts, json.ts
- [ ] README.md, docs/
- [ ] resources/

## 7. Success Criteria

- Extension appears as "Meta" in Copilot Chat model picker
- User can set API key via command, stored in SecretStorage
- Chat works with streaming, tool calling, image input
- Reasoning effort dropdown works (minimal..xhigh)
- No vision proxy needed for images
- Pricing/cost info shows correctly
- Error messages user-friendly for 401, 429, 400
- Works with VS Code 1.116+
