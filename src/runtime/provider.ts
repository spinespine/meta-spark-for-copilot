import vscode from 'vscode';
import { logger } from '../logger';
import { MetaChatProvider } from '../provider';

export async function registerProvider(
	context: vscode.ExtensionContext,
): Promise<MetaChatProvider> {
	const provider = new MetaChatProvider(context);

	context.subscriptions.push(
		vscode.commands.registerCommand('meta-spark.setApiKey', () => provider.configureApiKey()),
		vscode.commands.registerCommand('meta-spark.clearApiKey', () => provider.clearApiKey()),
		vscode.lm.registerLanguageModelChatProvider('meta', provider),
	);

	await activateCopilotChat();
	provider.refreshModelPicker();

	return provider;
}

async function activateCopilotChat(): Promise<void> {
	try {
		await vscode.extensions.getExtension('github.copilot-chat')?.activate();
	} catch (error) {
		logger.warn('Copilot Chat activation unavailable; model picker refresh may be delayed', error);
	}
}
