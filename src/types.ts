/**
 * Shared types for the Meta Spark Copilot extension.
 */

export interface MetaMessageContentText {
	type: 'text';
	text: string;
}

export interface MetaMessageContentImage {
	type: 'image_url';
	image_url: { url: string };
}

export type MetaMessageContentPart = MetaMessageContentText | MetaMessageContentImage;

export interface MetaMessage {
	role: 'system' | 'developer' | 'user' | 'assistant' | 'tool';
	content: string | MetaMessageContentPart[];
	tool_call_id?: string;
	tool_calls?: MetaToolCall[];
	reasoning_content?: string;
}

export interface MetaToolCall {
	id: string;
	type: 'function';
	function: {
		name: string;
		arguments: string;
	};
}

export interface MetaTool {
	type: 'function';
	function: {
		name: string;
		description?: string;
		parameters?: Record<string, unknown>;
	};
}

export interface MetaUsage {
	prompt_tokens: number;
	completion_tokens: number;
	total_tokens: number;
	prompt_tokens_details?: {
		cached_tokens?: number;
	};
	completion_tokens_details?: {
		reasoning_tokens?: number;
	};
	// legacy cache fields retained for diagnostics compatibility
	prompt_cache_hit_tokens?: number;
	prompt_cache_miss_tokens?: number;
}

export type ReasoningEffort = 'minimal' | 'low' | 'medium' | 'high' | 'xhigh';

export interface MetaRequest {
	model: string;
	messages: MetaMessage[];
	stream: boolean;
	temperature?: number;
	top_p?: number;
	max_completion_tokens?: number;
	max_tokens?: number;
	tools?: MetaTool[];
	tool_choice?: 'auto';
	reasoning_effort?: ReasoningEffort;
	prompt_cache_key?: string;
	stream_options?: {
		include_usage: boolean;
	};
}

export interface MetaStreamChunk {
	id: string;
	object: string;
	created: number;
	model: string;
	choices: Array<{
		index: number;
		delta: {
			role?: string;
			content?: string;
			reasoning_content?: string;
			tool_calls?: Array<{
				index: number;
				id?: string;
				type?: string;
				function?: {
					name?: string;
					arguments?: string;
				};
			}>;
		};
		finish_reason: string | null;
	}>;
	usage?: MetaUsage;
}

export interface StreamCallbacks {
	onContent: (content: string) => void;
	onThinking: (text: string) => void;
	onToolCall: (toolCall: MetaToolCall) => void;
	onError: (error: Error) => void;
	onDone: () => void;
	onUsage?: (usage: MetaUsage) => void;
}

export type PricingCurrency = 'USD';
export type PriceCategory = 'low' | 'medium' | 'high' | 'very_high';

export interface ModelPricingUSD {
	input: number;
	cachedInput: number;
	output: number;
}

export interface ModelPricingLegacy {
	cacheHitInput: number;
	cacheMissInput: number;
	output: number;
}

export type ModelPricing = ModelPricingUSD | ModelPricingLegacy;

export interface ModelDefinition {
	id: string;
	name: string;
	family: string;
	version: string;
	detail: string;
	maxInputTokens: number;
	maxOutputTokens: number;
	capabilities: {
		toolCalling: boolean | number;
		imageInput: boolean;
		thinking: boolean;
	};
	requiresThinkingParam: boolean;
	pricing?: Readonly<Record<PricingCurrency, ModelPricing>>;
	priceCategory?: PriceCategory;
}
