import { META_TOOLS_LIMIT } from './provider/tools/consts';
import type { ModelDefinition } from './types';

export const CONFIG_SECTION = 'meta-spark-copilot';

export const EXTERNAL_URLS = {
	meta: {
		apiKeys: 'https://dev.meta.ai/',
		usage: 'https://dev.meta.ai/',
		status: 'https://dev.meta.ai/status',
	},
} as const;

export const SHOW_LOGS_URI_PATH = '/showLogs';
export const CONFIGURE_API_KEY_URI_PATH = '/setApiKey';
export const SET_VISION_MODEL_URI_PATH = '/setVisionModel';

export const LANGUAGE_MODEL_CHAT_SYSTEM_ROLE = 3;

export const API_KEY_SECRET = 'meta-spark.apiKey';
export const WELCOME_SHOWN_KEY = 'meta-spark.welcomeShown';
export const WALKTHROUGH_ID = 'Vizards.meta-spark-for-copilot#metaGettingStarted';

export const MODELS: ModelDefinition[] = [
	{
		id: 'muse-spark-1.1',
		name: 'Muse Spark 1.1',
		family: 'meta',
		version: '1.1',
		detail: 'Agentic coding, 1M context, native vision',
		maxInputTokens: 1048576,
		maxOutputTokens: 131072,
		capabilities: {
			toolCalling: META_TOOLS_LIMIT,
			imageInput: true,
			thinking: true,
		},
		requiresThinkingParam: false,
		pricing: {
			USD: { input: 1.25, cachedInput: 0.15, output: 4.25 },
		},
		priceCategory: 'low',
	},
];
