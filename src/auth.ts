import vscode from 'vscode';
import { API_KEY_SECRET } from './consts';
import { t } from './i18n';

export class AuthManager {
	private readonly secretStorage: vscode.SecretStorage;

	constructor(context: vscode.ExtensionContext) {
		this.secretStorage = context.secrets;
	}

	async getApiKey(): Promise<string | undefined> {
		const secretKey = await this.secretStorage.get(API_KEY_SECRET);
		if (secretKey) {
			return secretKey;
		}
		const config = vscode.workspace.getConfiguration('meta-spark-copilot');
		const settingsKey = config.get<string>('apiKey');
		if (settingsKey?.trim()) {
			return settingsKey.trim();
		}
		return undefined;
	}

	async setApiKey(apiKey: string): Promise<void> {
		await this.secretStorage.store(API_KEY_SECRET, apiKey.trim());
	}

	async deleteApiKey(): Promise<void> {
		await this.secretStorage.delete(API_KEY_SECRET);
	}

	async hasApiKey(): Promise<boolean> {
		const key = await this.getApiKey();
		return key !== undefined && key.length > 0;
	}

	async promptForApiKey(): Promise<boolean> {
		const apiKey = await vscode.window.showInputBox({
			prompt: t('auth.prompt'),
			placeHolder: t('auth.placeholder'),
			password: true,
			ignoreFocusOut: true,
			validateInput: (value: string) => {
				if (!value?.trim()) {
					return t('auth.emptyValidation');
				}
				const trimmed = value.trim();
				if (!trimmed.startsWith('LLM')) {
					return 'Invalid format, expected LLM... (Meta API key)';
				}
				return undefined;
			},
		});

		if (apiKey) {
			await this.setApiKey(apiKey);
			vscode.window.showInformationMessage(t('auth.saved'));
			return true;
		}

		return false;
	}
}
