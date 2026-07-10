import type { VisionDescriber } from './types';

export function createVisionService(_context: any): {
	get: () => Promise<VisionDescriber | undefined>;
	reset: () => void;
	openConfiguration: () => Promise<void>;
} {
	return {
		async get() {
			return undefined;
		},
		reset() {},
		async openConfiguration() {},
	};
}
