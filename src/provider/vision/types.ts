import type { ReplayMarkerMetadata } from '../replay';
export type VisionProxySource = 'api-endpoint' | 'vscode-lm';
export interface VisionImagePart {
	mimeType: string;
	data: Uint8Array;
}
export interface VisionDescriptionRequest {
	prompt: string;
	images: readonly VisionImagePart[];
	token: any;
}
export interface VisionDescriber {
	readonly id: string;
	readonly source: VisionProxySource;
	describe(request: VisionDescriptionRequest): Promise<string>;
}
export interface VisionResolutionStats {
	inputImageParts: number;
	inputImageMessages: number;
	currentImageMessages: number;
	generatedImageMessages: number;
	replayedImageMessages: number;
	omittedImageMessages: number;
	unavailableImageMessages: number;
	failedImageMessages: number;
	droppedImageParts: number;
	markerVisionTextChars: number;
	invalidMarkerVisionMetadata: number;
}
export interface VisionResolutionResult {
	messages: readonly any[];
	stats: VisionResolutionStats;
	replayMarkerMetadata: ReplayMarkerMetadata;
	visionModelId?: string;
	visionProxySource?: VisionProxySource;
	initialResponseNotice?: string;
}
