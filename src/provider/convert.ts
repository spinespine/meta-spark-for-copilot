import vscode from 'vscode';
import { safeStringify } from '../json';
import type { MetaMessage, MetaMessageContentPart, MetaTool, MetaToolCall } from '../types';
import { parseFirstReplayMarker } from './replay';

const MAX_IMAGES_PER_REQUEST = 50;

export function convertMessages(
	messages: readonly vscode.LanguageModelChatRequestMessage[],
	isThinkingModel: boolean,
): MetaMessage[] {
	const result: MetaMessage[] = [];
	let imageCount = 0;

	for (const message of messages) {
		const role = mapRole(message.role);

		let textContent = '';
		let thinkingContent = '';
		const toolCalls: MetaToolCall[] = [];
		const toolResults: Array<{ callId: string; content: string }> = [];
		const imageParts: MetaMessageContentPart[] = [];

		for (const part of message.content) {
			if (part instanceof vscode.LanguageModelTextPart) {
				textContent += part.value;
			} else if (isLanguageModelThinkingPart(part)) {
				thinkingContent += normalizeThinkingPartText(part.value);
			} else if (part instanceof vscode.LanguageModelToolCallPart) {
				toolCalls.push({
					id: part.callId,
					type: 'function',
					function: {
						name: part.name,
						arguments: safeStringify(part.input),
					},
				});
			} else if (part instanceof vscode.LanguageModelToolResultPart) {
				let toolContent = '';
				for (const item of part.content) {
					if (item instanceof vscode.LanguageModelTextPart) {
						toolContent += item.value;
					}
				}
				toolResults.push({
					callId: part.callId,
					content: toolContent || safeStringify(part.content),
				});
			} else if (part instanceof vscode.LanguageModelDataPart) {
				if (part.mimeType.startsWith('image/')) {
					if (imageCount < MAX_IMAGES_PER_REQUEST) {
						try {
							const dataUrl = dataPartToDataUrl(part);
							imageParts.push({
								type: 'image_url',
								image_url: { url: dataUrl },
							});
							imageCount++;
						} catch {
							// skip invalid image
						}
					}
				}
			}
		}

		if (role === 'assistant') {
			if (textContent || toolCalls.length > 0) {
				const replayMarker = isThinkingModel ? parseFirstReplayMarker(message) : undefined;
				const msg: MetaMessage = {
					role: 'assistant' as const,
					content: textContent || '',
				};

				if (toolCalls.length > 0) {
					msg.tool_calls = toolCalls;
				}

				if (isThinkingModel) {
					msg.reasoning_content = getReasoningContent(replayMarker, thinkingContent);
				}

				result.push(msg);
			}
		} else {
			// user or developer/system
			if (textContent || imageParts.length > 0) {
				if (imageParts.length > 0) {
					const contentParts: MetaMessageContentPart[] = [];
					if (textContent) {
						contentParts.push({ type: 'text', text: textContent });
					}
					contentParts.push(...imageParts);
					result.push({
						role: role as 'user' | 'developer' | 'system',
						content: contentParts,
					});
				} else {
					result.push({
						role: role as 'user' | 'developer' | 'system',
						content: textContent,
					});
				}
			}
		}

		for (const tr of toolResults) {
			result.push({
				role: 'tool',
				content: tr.content,
				tool_call_id: tr.callId,
			});
		}
	}

	return result;
}

function dataPartToDataUrl(part: vscode.LanguageModelDataPart): string {
	const base64 = Buffer.from(part.data).toString('base64');
	return `data:${part.mimeType};base64,${base64}`;
}

function getReasoningContent(
	replayMarker: ReturnType<typeof parseFirstReplayMarker>,
	thinkingContent: string,
): string {
	if (replayMarker?.valid && replayMarker.reasoningText) {
		return replayMarker.reasoningText;
	}
	return thinkingContent;
}

function isLanguageModelThinkingPart(part: unknown): part is vscode.LanguageModelThinkingPart {
	return (
		typeof vscode.LanguageModelThinkingPart === 'function' &&
		part instanceof vscode.LanguageModelThinkingPart
	);
}

function normalizeThinkingPartText(value: string | string[]): string {
	return Array.isArray(value) ? value.join('') : value;
}

function mapRole(
	role: vscode.LanguageModelChatMessageRole,
): 'user' | 'assistant' | 'developer' | 'system' {
	switch (role) {
		case vscode.LanguageModelChatMessageRole.User:
			return 'user';
		case vscode.LanguageModelChatMessageRole.Assistant:
			return 'assistant';
		default:
			// System role (3) -> developer per Meta docs (higher precedence)
			return 'developer';
	}
}

export function convertTools(
	tools: readonly vscode.LanguageModelChatTool[] | undefined,
): MetaTool[] | undefined {
	if (!tools || tools.length === 0) {
		return undefined;
	}

	return tools.map((tool) => ({
		type: 'function' as const,
		function: {
			name: tool.name,
			description: tool.description,
			parameters: tool.inputSchema as Record<string, unknown> | undefined,
		},
	}));
}

export function countMessageChars(messages: MetaMessage[]): number {
	let total = 0;
	for (const msg of messages) {
		if (typeof msg.content === 'string') {
			total += msg.content.length;
		} else {
			for (const part of msg.content) {
				if (part.type === 'text') {
					total += part.text?.length ?? 0;
				}
				// image_url not counted as chars, but approximate
				if (part.type === 'image_url') {
					total += 1000;
				}
			}
		}
		total += msg.reasoning_content?.length ?? 0;
		if (msg.tool_calls) {
			for (const tc of msg.tool_calls) {
				total += tc.function?.name?.length ?? 0;
				total += tc.function?.arguments?.length ?? 0;
			}
		}
	}
	return total;
}
