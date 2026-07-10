import vscode from 'vscode';
import { t } from '../i18n';
import type { ModelDefinition, PricingCurrency } from '../types';
import { toModelCostInfo, type ModelCostInformation } from './pricing/costs';

export type ThinkingEffort = 'minimal' | 'low' | 'medium' | 'high' | 'xhigh';

export type ModelConfigurationOptions = vscode.ProvideLanguageModelChatResponseOptions & {
	readonly modelConfiguration?: Record<string, unknown>;
	readonly configuration?: Record<string, unknown>;
};

type ThinkingEffortConfigurationSchema = ReturnType<typeof buildThinkingEffortSchema>;

export type ModelPickerChatInformation = vscode.LanguageModelChatInformation &
	ModelCostInformation & {
		readonly isUserSelectable: boolean;
		readonly isBYOK: true;
		readonly statusIcon?: vscode.ThemeIcon;
		readonly configurationSchema?: ThinkingEffortConfigurationSchema;
	};

export function toChatInfo(
	m: ModelDefinition,
	hasApiKey: boolean,
	pricingCurrency?: PricingCurrency,
): ModelPickerChatInformation {
	const modelDetail = resolveModelText(m, 'detail') ?? m.detail;
	const modelTooltip = resolveModelText(m, 'tooltip');
	return {
		id: m.id,
		name: m.name,
		family: m.family,
		version: m.version,
		detail: hasApiKey ? modelDetail : t('auth.apiKeyRequiredDetail'),
		tooltip: hasApiKey ? modelTooltip : t('auth.apiKeyRequiredDetail'),
		statusIcon: hasApiKey ? undefined : new vscode.ThemeIcon('warning'),
		maxInputTokens: m.maxInputTokens,
		maxOutputTokens: m.maxOutputTokens,
		isBYOK: true,
		isUserSelectable: true,
		capabilities: {
			toolCalling: m.capabilities.toolCalling,
			imageInput: m.capabilities.imageInput,
		},
		...toModelCostInfo(m, pricingCurrency),
		...(m.capabilities.thinking ? { configurationSchema: buildThinkingEffortSchema() } : {}),
	};
}

export function getConfiguredThinkingEffort(options: ModelConfigurationOptions): ThinkingEffort {
	const configuredEffort =
		options.modelConfiguration?.reasoningEffort ?? options.configuration?.reasoningEffort;

	if (typeof configuredEffort === 'string') {
		const normalized = configuredEffort.toLowerCase();
		if (normalized === 'none') return 'minimal';
		if (normalized === 'minimal') return 'minimal';
		if (normalized === 'low') return 'low';
		if (normalized === 'medium') return 'medium';
		if (normalized === 'high') return 'high';
		if (normalized === 'xhigh' || normalized === 'max' || normalized === 'extra-high' || normalized === 'extra_high') return 'xhigh';
	}

	return 'medium';
}

function buildThinkingEffortSchema() {
	return {
		properties: {
			reasoningEffort: {
				type: 'string',
				title: t('status.thinking'),
				enum: ['minimal', 'low', 'medium', 'high', 'xhigh'],
				enumItemLabels: [t('thinking.minimal'), t('thinking.low'), t('thinking.medium'), t('thinking.high'), t('thinking.xhigh')],
				enumDescriptions: [
					t('thinking.minimal.desc'),
					t('thinking.low.desc'),
					t('thinking.medium.desc'),
					t('thinking.high.desc'),
					t('thinking.xhigh.desc'),
				],
				default: 'medium',
				group: 'navigation',
			},
		},
	} as const;
}

function resolveModelText(m: ModelDefinition, field: 'detail' | 'tooltip'): string | undefined {
	const suffix = m.id.startsWith('muse-spark-') ? m.id.slice('muse-spark-'.length) : m.id;
	const key = `model.${suffix}.${field}`;
	const translated = t(key);
	return translated !== key ? translated : undefined;
}
