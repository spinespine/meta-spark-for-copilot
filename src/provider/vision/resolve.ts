import vscode from 'vscode';
import type { VisionResolutionResult, VisionResolutionStats } from './types';

export async function resolveImageMessages(
	messages: readonly vscode.LanguageModelChatRequestMessage[],
	_token: vscode.CancellationToken,
	_getDescriber: () => Promise<any>,
): Promise<VisionResolutionResult> {
	const stats = createVisionResolutionStats();
	collectInputImageStats(messages, stats);
	// Native vision: keep messages as-is, no proxy needed
	return {
		messages,
		stats,
		replayMarkerMetadata: {},
	};
}

function createVisionResolutionStats(): VisionResolutionStats {
	return {
		inputImageParts: 0,
		inputImageMessages: 0,
		currentImageMessages: 0,
		generatedImageMessages: 0,
		replayedImageMessages: 0,
		omittedImageMessages: 0,
		unavailableImageMessages: 0,
		failedImageMessages: 0,
		droppedImageParts: 0,
		markerVisionTextChars: 0,
		invalidMarkerVisionMetadata: 0,
	};
}

function collectInputImageStats(
	messages: readonly vscode.LanguageModelChatRequestMessage[],
	stats: VisionResolutionStats,
): void {
	for (const message of messages) {
		const imageParts = getImageParts(message).length;
		if (imageParts === 0) continue;
		stats.inputImageMessages += 1;
		stats.inputImageParts += imageParts;
	}
}

function getImageParts(
	message: vscode.LanguageModelChatRequestMessage,
): vscode.LanguageModelDataPart[] {
	return (message.content as readonly vscode.LanguageModelInputPart[]).filter(isImageDataPart) as any;
}

function isImageDataPart(part: unknown): part is vscode.LanguageModelDataPart {
	return part instanceof vscode.LanguageModelDataPart && part.mimeType.startsWith('image/');
}
