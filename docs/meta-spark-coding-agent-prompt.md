# Coding Agent Prompt: Build Meta Muse Spark 1.1 for Copilot Chat

> Copy-paste this entire prompt into your coding agent (Claude Code, Cursor, Copilot Agent, OpenCode, etc.) after cloning `deepseek-v4-for-copilot` as a base.

---

## ROLE

You are a senior VS Code extension engineer. You are porting an existing, working VS Code extension that exposes DeepSeek V4 models in the native Copilot Chat model picker, to instead expose Meta's Muse Spark 1.1 model.

## CONTEXT

**Source repo:** `deepseek-v4-for-copilot` (current workspace)
- It contributes `languageModelChatProviders: [{vendor: "deepseek"}]` and registers `vscode.lm.registerLanguageModelChatProvider('deepseek', provider)`
- It implements `vscode.LanguageModelChatProvider` with two methods: `provideLanguageModelChatInformation()` (returns model list) and `provideLanguageModelChatResponse()` (streams chat)
- Data flow: VS Code Chat messages → `resolveConversationSegment` + `classifyProviderRequest` → `resolveImageMessages` (vision proxy, because DeepSeek is text-only) → `convertMessages` → build `DeepSeekRequest` → `DeepSeekClient.streamChatCompletion()` POST to `{baseUrl}/chat/completions` SSE → `progress.report(LanguageModelTextPart/ThinkingPart/ToolCallPart)` → VS Code renders
- Key files: `src/consts.ts` (MODELS, CONFIG_SECTION, secrets), `src/config.ts` (getBaseUrl, getApiModelId), `src/auth.ts` (SecretStorage), `src/types.ts` (request/response types), `src/client/core.ts` (fetch SSE), `src/provider/convert.ts` (VS Code → API), `src/provider/request.ts` (build request), `src/provider/stream.ts` (map callbacks to progress), `src/provider/models.ts` (toChatInfo + thinking effort schema), `src/provider/vision/` (complex proxy that describes images via another Copilot model), `src/runtime/provider.ts` (registration)

**Target:** Same UX, but for Meta Muse Spark 1.1

## META MUSE SPARK 1.1 API SPEC (from https://dev.meta.ai/docs/)

**Base URL:** `https://api.meta.ai/v1`
**Model ID:** `muse-spark-1.1` (single model, 1,048,576 context, 131072 max output, multimodal input text/image/video/PDF, text output)
**Auth:** `Authorization: Bearer $MODEL_API_KEY`, key format `LLM|{numeric_id}|{secret}` e.g. `LLM|607358788850350|nx9...LJY`. Dashboard: https://dev.meta.ai/
**Endpoints:**
- `POST /v1/chat/completions` – OpenAI-compatible, use this for v1. Request: `{model, messages: [{role: developer|system|user|assistant|tool, content: string | [{type:text, text}|{type:image_url, image_url:{url: https://... or data:image/jpeg;base64,...}}]}], tools?: [{type:function, function:{name, description, parameters:{type:object, properties, required, additionalProperties:false}}}], tool_choice?: "auto" (ONLY auto allowed, none/required/named → 400), reasoning_effort?: "minimal"|"low"|"medium"|"high"|"xhigh" (none NOT supported → 400, default model-determined), max_completion_tokens?: int (shares context window), temperature?: 0-2 default 1.0, top_p?: 0-1 default 1.0, prompt_cache_key?: string stable for cache hits, stream?: bool, stream_options?: {include_usage:true}}`
- Response: `{id, object: chat.completion, created, model, choices: [{index, message: {role:assistant, content, tool_calls?: [{id, type:function, function:{name, arguments: JSON string}}]}, finish_reason: stop|tool_calls}], usage: {prompt_tokens, completion_tokens, total_tokens, prompt_tokens_details:{cached_tokens}, completion_tokens_details:{reasoning_tokens}}}`
- Streaming: SSE `data: {...}` lines, `data: [DONE]`. Each chunk: `choices[0].delta: {role?, content?, tool_calls?: [{index, id?, type?, function?:{name?, arguments?}}], reasoning_content?}`. Note: `reasoning_content` is REDACTED to empty for external callers on Chat Completions (only internal `internal:private_cot` sees it). So thinking UI won't show. Usage may be on every chunk, keep latest.
- `POST /v1/responses` – Full feature set, preserves reasoning across turns via `previous_response_id` or encrypted `reasoning` items, supports `reasoning: {effort, summary: auto|concise|detailed}`, `include: ["reasoning.encrypted_content"]`, typed `input` array with `input_text`, `input_image`, `input_file`, `function_call`, `function_call_output`, `phase: commentary|final_answer`. Streaming events: `response.output_text.delta`, `response.reasoning_summary_text.delta`, `response.function_call_arguments.delta`, etc. **Do NOT use for v1 unless you want extra complexity; document as phase 2.**

**Tool Calling:**
- Chat Completions: send `tools`, model returns `tool_calls` array, you execute locally, return `tool` messages with `tool_call_id` matching. Must include full assistant message with `tool_calls` when replaying history. `call_id` 1-64 chars. Function name regex `^[a-zA-Z0-9_.-]+$` max one dot. `parallel_tool_calls` defaults true.
- Responses API: flat tool defs `{type:function, name, description, parameters}`, returns `function_call` items in `output[]`, results via `function_call_output` with `call_id`.

**Vision (NATIVE, no proxy needed!):**
- Chat Completions: `content` can be array: `[{type:text, text:"..."}, {type:image_url, image_url:{url: "https://..." or "data:image/jpeg;base64,..."}}]`. Only in `user` role. Up to 50 images per request, 50MB inline, 1GiB via Files API. Token cost ~1300-1500 tokens for 1280px image.
- Responses API: `input_image` blocks with `image_url` string or `file_id`, or `input_file` with `file_id` or `file_url`.

**Pricing:** $1.25 / 1M input, $0.15 / 1M cached input, $4.25 / 1M output. No long-context premium.
**Rate Limits:** Free 60 RPM / 2M TPM, Paid 3000 RPM / 4M TPM per team. Headers `x-ratelimit-limit-tokens`, `x-ratelimit-remaining-tokens`, `x-ratelimit-limit-requests`, `x-ratelimit-remaining-requests`. 429 with `Retry-After`.
**Errors:** JSON `{error:{message, type: invalid_request_error|authentication_error|rate_limit_error|server_error|billing_error, param, code: invalid_api_key|model_not_found|file_not_found|rate_limit_exceeded|server_shutting_down|payload_too_large|gateway_timeout|content_policy_violation}}`. 404 on unknown path returns empty body. Streaming errors via `response.failed` or `error` SSE events. 503 `server_shutting_down` is retryable. 504 `gateway_timeout` for non-streaming long requests → must stream.
**Prompt Caching:** Automatic prefix caching, no flag. Usage reports `prompt_tokens_details.cached_tokens` (chat) or `input_tokens_details.cached_tokens` (responses). Optional `prompt_cache_key` stable string to improve hit rate, `prompt_cache_retention: in_memory|24h` on Responses.
**Unsupported on Chat Completions:** `stop`, `n>1`, `logit_bias`, `verbosity`, `logprobs:true`, `modalities`, `audio`, `web_search_options` → 400. `text.format` belongs to Responses, use `response_format` for structured output on Chat.

## GOAL

Create a new VS Code extension `meta-spark-for-copilot` (or `llama-spark-for-copilot`) that:

1. Appears as "Meta" vendor in Copilot Chat model picker with model "Muse Spark 1.1"
2. Uses BYOK via SecretStorage, key format `LLM|...`
3. Supports streaming, tool calling (agent mode), native image input (no proxy), reasoning effort control (minimal/low/medium/high/xhigh)
4. Handles errors user-friendly (401 invalid_api_key, 429 rate limit, 400 content_policy_violation, etc.)
5. Reports token usage and cache hits
6. Zero runtime dependencies, pure VS Code API + fetch

## TASKS (in order)

### Phase 0 – Scaffolding
- Clone/copy current repo to new folder, `npm install`, verify `npm run compile` works
- Rename in `package.json`: `name: meta-spark-for-copilot`, `displayName: Muse Spark 1.1 for Copilot Chat`, `description: Pick Muse Spark 1.1 from Copilot Chat model picker...`, `publisher`, `icon`, `repository`, `keywords` (meta, llama, spark), `categories`
- Update `package.nls.json` and `package.nls.zh-cn.json` keys from `deepseek-copilot.*` to `meta-spark.*`

### Phase 1 – Core Renaming
- Global rename: `deepseek-copilot` → `meta-spark-copilot` (config section), `deepseek` vendor → `meta` (or `meta-ai` to avoid collision), `DeepSeek` classes → `Meta`, `DEEPSEEK_` constants → `META_`, `deepseek-copilot.apiKey` secret → `meta-spark.apiKey`
- `src/consts.ts`:
  - `CONFIG_SECTION = 'meta-spark-copilot'`
  - `API_KEY_SECRET = 'meta-spark.apiKey'`
  - `WELCOME_SHOWN_KEY = 'meta-spark.welcomeShown'`
  - `EXTERNAL_URLS = { meta: { apiKeys: 'https://dev.meta.ai/', usage: 'https://dev.meta.ai/', status: 'https://dev.meta.ai/status' } }`
  - `MODELS = [{ id: 'muse-spark-1.1', name: 'Muse Spark 1.1', family: 'meta', version: '1.1', detail: 'Agentic coding, 1M context, native vision', maxInputTokens: 1048576, maxOutputTokens: 131072, capabilities: { toolCalling: true, imageInput: true, thinking: true }, requiresThinkingParam: false, pricing: { USD: { input: 1.25, cachedInput: 0.15, output: 4.25 } }, priceCategory: 'low' }]`
  - Remove CNY pricing
- `src/config.ts`: default baseUrl `https://api.meta.ai/v1`, rename `getMaxTokens` → `getMaxCompletionTokens` but keep alias, update `getApiModelId` to handle `muse-spark-1.1`
- `src/endpoint.ts`: `OFFICIAL_META_API_HOST = 'api.meta.ai'`, `isOfficialMetaBaseUrl()`, `normalizeBaseUrl()`
- `src/auth.ts`: prompt "Enter your Meta API key (starts with LLM|)", placeholder "LLM|...", validation: must start with "LLM|" and contain 2 pipes, otherwise show error "Invalid format, expected LLM|..."

### Phase 2 – Types & Client
- `src/types.ts` rewrite:
  ```ts
  export interface MetaMessage {
    role: 'system'|'developer'|'user'|'assistant'|'tool';
    content: string | Array<{type:'text', text?:string} | {type:'image_url', image_url:{url:string}}>;
    tool_call_id?: string;
    tool_calls?: MetaToolCall[];
  }
  export interface MetaToolCall { id:string; type:'function'; function:{name:string; arguments:string} }
  export interface MetaTool { type:'function'; function:{name:string; description?:string; parameters?: Record<string,unknown>} }
  export interface MetaUsage { prompt_tokens:number; completion_tokens:number; total_tokens:number; prompt_tokens_details?:{cached_tokens?:number}; completion_tokens_details?:{reasoning_tokens?:number} }
  export interface MetaRequest { model:string; messages:MetaMessage[]; stream:boolean; temperature?:number; top_p?:number; max_completion_tokens?:number; tools?:MetaTool[]; tool_choice?:'auto'; reasoning_effort?:'minimal'|'low'|'medium'|'high'|'xhigh'; prompt_cache_key?:string; stream_options?:{include_usage:boolean} }
  export interface MetaStreamChunk { id:string; object:string; created:number; model:string; choices:Array<{index:number; delta:{role?:string; content?:string; reasoning_content?:string; tool_calls?:Array<{index:number; id?:string; type?:string; function?:{name?:string; arguments?:string}}>}; finish_reason:string|null}>; usage?:MetaUsage }
  ```
- `src/client/core.ts`: rename `DeepSeekClient` → `MetaClient`, keep fetch logic, URL `${baseUrl}/chat/completions`, keep `stream_options: {include_usage:true}`, update error handling to parse Meta error format, keep tool call accumulation by index, handle `reasoning_content` (may be empty, still call onThinking if non-empty)
- `src/client/error/`: rename `DeepSeekRequestError` → `MetaRequestError`, update messages for 401 (check LLM| format), 429 (show Retry-After), 400 content_policy_violation, 503 server_shutting_down retryable, 504 gateway_timeout suggest streaming

### Phase 3 – Provider Logic
- `src/provider/convert.ts` MAJOR CHANGE:
  - `convertMessages()` must handle `LanguageModelDataPart` image parts: convert each to base64 data URL `data:{mimeType};base64,{Buffer.from(part.data).toString('base64')}` and produce `content` array with text parts + image_url parts. If no images, keep content as string for simplicity, or always array. Must handle `LanguageModelTextPart`, `LanguageModelThinkingPart` (keep for replay but note it will be empty from API), `ToolCallPart`, `ToolResultPart`.
  - Map VS Code roles: `User→user`, `Assistant→assistant`, `System (role 3)→developer` (preferred per Meta docs, system also works but developer has higher precedence)
  - `convertTools()` same but ensure `additionalProperties:false` if missing? Meta auto-adds root type object if missing, but recommend setting it.
  - `countMessageChars()` handle array content
  - Helper: `function dataPartToDataUrl(part: vscode.LanguageModelDataPart): string`
- `src/provider/request.ts`:
  - Build `MetaRequest` not DeepSeekRequest
  - Get `reasoning_effort` from config, default `medium` (not high). Map legacy `none` → `minimal` with warning, `high`→`high`, `max`→`xhigh`
  - Set `tool_choice: tools?.length ? 'auto' : undefined` (NEVER none/required)
  - Set `max_completion_tokens` from config
  - Set `prompt_cache_key: "vscode-copilot-meta-spark"` stable key for better cache hits
  - Remove `thinking` field
  - Keep vision resolution but now native: call simplified `resolveImageMessages` that just passes through images (no describer)
- `src/provider/stream.ts`:
  - `onThinking` may never fire (reasoning_content empty for external). Keep handler but skip if empty. Optionally log info that thinking not exposed on Chat Completions, suggest Responses API for summaries in future.
  - `onContent`, `onToolCall` same
  - `onUsage`: map `prompt_tokens_details.cached_tokens` and `completion_tokens_details.reasoning_tokens` to diagnostics, update chars-per-token calibration
- `src/provider/models.ts`:
  - `ThinkingEffort = 'minimal'|'low'|'medium'|'high'|'xhigh'`
  - `buildThinkingEffortSchema()` enum 5 values, labels: Minimal (fastest), Low, Medium (balanced, default), High (deep), Extra High (max), descriptions, default medium
  - `getConfiguredThinkingEffort()` reads `modelConfiguration.reasoningEffort`, maps `none→minimal`, `max→xhigh`, default medium
  - `toChatInfo()` with Meta pricing
- `src/provider/routing/classifier.ts`: keep classification, but `shouldForceThinkingNone` → `shouldForceMinimalThinking` since none not supported. For helper requests (todo-tracker, prompt-categorizer, etc), force `minimal` not `none`
- `src/provider/tools/request.ts`: enforce tool_choice auto, set tool limit high (e.g., 128) or true

### Phase 4 – Vision Simplification
- `src/provider/vision/resolve.ts` rewrite to NATIVE:
  - Since Meta has native vision, don't proxy. Keep image parts in messages, just collect stats. Return messages unchanged (or with image parts preserved). No describer needed.
  - Simplify to: count inputImageParts, return {messages, stats, replayMarkerMetadata:{}}
  - Remove failure notices for missing proxy
- `src/provider/vision/service.ts`: make `createVisionService` return `{get: async () => undefined, reset: ()=>{}, openConfiguration: async ()=>{}}` no-op, or delete and inline
- Keep `vision/types.ts` minimal, or delete folder and move logic to `convert.ts` – but minimal diff: keep folder, make service no-op
- Update `package.json` config: remove `visionModel`, `visionPrompt` or keep deprecated with description "Not needed, native vision"

### Phase 5 – Runtime & Config
- `src/runtime/provider.ts`: `vscode.lm.registerLanguageModelChatProvider('meta', provider)`, commands `meta-spark.setApiKey` etc, `activateCopilotChat()` still needed
- `src/runtime/commands.ts`, `actions.ts`, `lifecycle.ts`: update command IDs, log messages, URIs
- `package.json`:
  - `languageModelChatProviders: [{vendor:"meta", displayName:"Meta"}]`
  - commands: `meta-spark.setApiKey`, `getApiKey`, `clearApiKey`, `openSettings`, `showLogs`, `openRequestDumpsFolder`
  - configuration: `meta-spark-copilot.baseUrl` default `https://api.meta.ai/v1`, `maxCompletionTokens` (or `maxTokens` alias), `modelIdOverrides` with `muse-spark-1.1`, `debugMode`, remove visionModel or keep deprecated
  - walkthroughs id `metaGettingStarted`
- `src/i18n.ts` and `package.nls.json`: update all strings

### Phase 6 – Testing & Polish
- `npm run compile`, fix TS errors
- Manual test: set API key `LLM|...`, open Copilot Chat, pick Muse Spark 1.1, test:
  - Simple chat "What is capital of France?"
  - Streaming
  - Tool calling: agent mode "Create a file hello.py"
  - Image input: drop screenshot, ask "Describe this"
  - Reasoning effort switching: minimal, low, medium, high, xhigh via model config dropdown
  - Rate limit handling (429)
  - Error handling: invalid key, 400
- Test token usage reporting, cache diagnostics
- Update README.md, CHANGELOG.md, LICENSE, screenshots
- Ensure `vscode.proposed.languageModelThinkingPart.d.ts` still works (thinking part may be empty, but keep)

### Phase 7 – Optional Responses API Enhancement (Future, not required for v1)
- Add config `useResponsesApi: boolean` default false
- If true, use `POST /v1/responses` with `input` array, `reasoning: {effort, summary:"auto"}`, `include: ["reasoning.encrypted_content"]`, handle `response.output_text.delta`, `response.reasoning_summary_text.delta`, `function_call` items, encrypted reasoning replay across turns
- This would enable thinking UI via reasoning summaries

## ACCEPTANCE CRITERIA

- [ ] Extension appears as "Meta" in Copilot Chat model picker with "Muse Spark 1.1"
- [ ] User can set API key via command, stored in SecretStorage, validated LLM| format
- [ ] Chat works with streaming
- [ ] Tool calling works in agent mode (file edits, terminal)
- [ ] Image input works natively (drop image, model sees it, no proxy)
- [ ] Reasoning effort dropdown works (minimal/low/medium/high/xhigh), default medium, none not allowed
- [ ] Pricing/cost info shows correctly (USD only)
- [ ] Error messages user-friendly for 401, 429, 400, 503, 504
- [ ] Token usage and cache hits logged
- [ ] Works with VS Code 1.116+
- [ ] `npm run compile` passes, no TS errors
- [ ] README updated

## CONSTRAINTS

- Zero runtime dependencies, pure VS Code API + Node fetch
- Keep existing architecture (provider, convert, request, stream, etc.) – don't rewrite from scratch
- Keep diagnostics, replay markers, segment logic
- Don't break Copilot Chat integration (isBYOK, isUserSelectable, configurationSchema)
- Handle `tool_choice` only auto
- Handle `reasoning_content` empty for external callers – don't crash
- Base64 encode images efficiently: `Buffer.from(part.data).toString('base64')`, data URL `data:${mime};base64,${b64}`
- Max 50 images per request – if more, drop oldest or error gracefully
- Keep `prompt_cache_key` stable for better cache hits

## REFERENCE LINKS

- Overview: https://dev.meta.ai/docs/getting-started/overview/
- Auth: https://dev.meta.ai/docs/getting-started/authentication
- Models: https://dev.meta.ai/docs/getting-started/models
- Chat Completion: https://dev.meta.ai/docs/features/chat-completion
- Responses API: https://dev.meta.ai/docs/features/responses
- Reasoning: https://dev.meta.ai/docs/features/reasoning
- Tool Calling: https://dev.meta.ai/docs/features/tool-calling
- Image Understanding: https://dev.meta.ai/docs/features/image-understanding
- Error Handling: https://dev.meta.ai/docs/getting-started/error-handling
- Pricing: https://dev.meta.ai/docs/getting-started/pricing-rate-limits
- Prompt Caching: https://dev.meta.ai/docs/features/prompt-caching
- API Ref Chat: https://dev.meta.ai/docs/api-reference/chat-completions/create-chat-completion
- API Ref Responses: https://dev.meta.ai/docs/api-reference/responses/create-response

## OUTPUT

Produce a complete, working VS Code extension in a new folder `meta-spark-for-copilot` (or rename current). Ensure `package.json`, `src/` all updated, `npm run compile` succeeds, and README explains how to use with Meta API key.

---

## QUICK COPY VERSION (for agents with limited context)

Port `deepseek-v4-for-copilot` VS Code extension to Meta Muse Spark 1.1. Base URL `https://api.meta.ai/v1`, model `muse-spark-1.1`, auth `Bearer LLM|...`, endpoint `POST /v1/chat/completions` OpenAI-compatible. Key changes: vendor `deepseek`→`meta`, config `deepseek-copilot`→`meta-spark-copilot`, secret `deepseek-copilot.apiKey`→`meta-spark.apiKey`, MODELS single entry 1M context native vision, request type `reasoning_effort: minimal|low|medium|high|xhigh` (none not supported), `tool_choice` only auto, messages content can be array with `image_url` data URLs (convert `LanguageModelDataPart` to base64 data URL), streaming delta `content` + `tool_calls` (reasoning_content empty for external), usage `prompt_tokens_details.cached_tokens`, pricing USD only $1.25/$0.15/$4.25. Simplify vision/ folder to no-op (native vision). Update all files, keep architecture, test compile.

