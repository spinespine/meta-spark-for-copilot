import type { ModelDefinition, PriceCategory, PricingCurrency } from '../../types';

export interface ModelCostInformation {
	readonly inputCost?: string;
	readonly outputCost?: string;
	readonly cacheCost?: string;
	readonly priceCategory?: PriceCategory;
}

export function toModelCostInfo(
	model: ModelDefinition,
	currency?: PricingCurrency,
): ModelCostInformation {
	if (!currency) {
		return {};
	}
	const pricing = model.pricing?.[currency];
	if (!pricing) {
		return {};
	}
	// Support both new USD format {input, cachedInput, output} and legacy {cacheHitInput, cacheMissInput, output}
	const anyPricing = pricing as any;
	const input = anyPricing.input ?? anyPricing.cacheMissInput;
	const cached = anyPricing.cachedInput ?? anyPricing.cacheHitInput;
	const output = anyPricing.output;
	return {
		...(model.priceCategory ? { priceCategory: model.priceCategory } : {}),
		inputCost: input !== undefined ? formatPriceValue(input, currency) : undefined,
		outputCost: output !== undefined ? formatPriceValue(output, currency) : undefined,
		cacheCost: cached !== undefined ? formatPriceValue(cached, currency) : undefined,
	};
}

function formatPriceValue(value: number, currency: PricingCurrency): string {
	return `$${value}`;
}
