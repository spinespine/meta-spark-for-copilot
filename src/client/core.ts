import type { CancellationToken } from 'vscode';
import { safeStringify } from '../json';
import { logger } from '../logger';
import type {
	MetaRequest,
	MetaStreamChunk,
	MetaToolCall,
	MetaUsage,
	StreamCallbacks,
} from '../types';
import { createHttpError, formatRequestError, normalizeRequestError } from './error';

export class MetaClient {
	constructor(
		private readonly baseUrl: string,
		private readonly apiKey: string,
	) {}

	async streamChatCompletion(
		request: MetaRequest,
		callbacks: StreamCallbacks,
		cancellationToken?: CancellationToken,
	): Promise<void> {
		const controller = new AbortController();
		const cancelListener = cancellationToken?.onCancellationRequested(() => {
			controller.abort();
		});
		if (cancellationToken?.isCancellationRequested) {
			controller.abort();
		}

		try {
			const requestBody = {
				...request,
				stream_options: { include_usage: true },
			};

			const response = await fetch(`${this.baseUrl}/chat/completions`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					Authorization: `Bearer ${this.apiKey}`,
				},
				body: safeStringify(requestBody),
				signal: controller.signal,
			});

			if (!response.ok) {
				throw await createHttpError(response, { baseUrl: this.baseUrl, request });
			}

			if (!response.body) {
				throw new Error('No response body received');
			}

			const reader = response.body.getReader();
			const decoder = new TextDecoder();
			let buffer = '';
			let latestUsage: MetaUsage | undefined;

			const pendingToolCalls = new Map<number, MetaToolCall>();

			while (true) {
				if (cancellationToken?.isCancellationRequested) {
					controller.abort();
					return;
				}

				const { done, value } = await reader.read();
				if (done) {
					break;
				}

				buffer += decoder.decode(value, { stream: true });

				const lines = buffer.split('\n');
				buffer = lines.pop() || '';

				for (const line of lines) {
					const trimmed = line.trim();

					if (!trimmed || trimmed.startsWith(':')) {
						continue;
					}

					if (trimmed === 'data: [DONE]') {
						for (const tc of pendingToolCalls.values()) {
							callbacks.onToolCall(tc);
						}
						pendingToolCalls.clear();
						reportFinalUsage(callbacks, latestUsage);
						callbacks.onDone();
						return;
					}

					if (!trimmed.startsWith('data: ')) {
						continue;
					}

					const jsonStr = trimmed.slice(6);
					try {
						const chunk: MetaStreamChunk = JSON.parse(jsonStr);
						const choice = chunk.choices?.[0];

						if (chunk.usage) {
							latestUsage = chunk.usage;
						}

						if (!choice) {
							continue;
						}

						const reasoning = choice.delta.reasoning_content;
						if (reasoning) {
							callbacks.onThinking(reasoning);
						}

						if (choice.delta.content) {
							callbacks.onContent(choice.delta.content);
						}

						if (choice.delta.tool_calls) {
							for (const tc of choice.delta.tool_calls) {
								let pending = pendingToolCalls.get(tc.index);
								if (!pending && tc.id) {
									pending = {
										id: tc.id,
										type: 'function',
										function: { name: '', arguments: '' },
									};
									pendingToolCalls.set(tc.index, pending);
								}
								if (pending) {
									if (tc.function?.name) {
										pending.function.name += tc.function.name;
									}
									if (tc.function?.arguments) {
										pending.function.arguments += tc.function.arguments;
									}
								}
							}
						}

						if (choice.finish_reason === 'tool_calls' || choice.finish_reason === 'stop') {
							for (const tc of pendingToolCalls.values()) {
								callbacks.onToolCall(tc);
							}
							pendingToolCalls.clear();
						}
					} catch (e) {
						logger.error('Failed to parse SSE chunk:', jsonStr.slice(0, 200), e);
					}
				}
			}

			reportFinalUsage(callbacks, latestUsage);
			callbacks.onDone();
		} catch (error) {
			if (isAbortError(error) && cancellationToken?.isCancellationRequested) {
				return;
			}
			const normalizedError = normalizeRequestError(error, { baseUrl: this.baseUrl, request });
			logger.error('Meta request failed:', formatRequestError(normalizedError));
			callbacks.onError(normalizedError);
		} finally {
			cancelListener?.dispose();
		}
	}
}

function reportFinalUsage(callbacks: StreamCallbacks, usage: MetaUsage | undefined): void {
	if (!usage || !callbacks.onUsage) {
		return;
	}
	callbacks.onUsage(usage);
}

function isAbortError(error: unknown): boolean {
	return error instanceof Error && error.name === 'AbortError';
}
