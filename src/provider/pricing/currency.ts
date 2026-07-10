import vscode from 'vscode';
import type { PricingCurrency } from '../../types';

const CACHE_KEY = 'meta-spark-copilot.balanceCurrency.cache';

export class BalanceCurrencyResolver {
	constructor(
		private readonly _context: vscode.ExtensionContext,
		private readonly _authManager: any,
		private readonly _onDidChangeCurrency: () => void,
	) {}

	getDisplayCurrency(): PricingCurrency | undefined {
		return 'USD';
	}

	refreshInBackground(): void {}

	async invalidate(): Promise<void> {}
}
