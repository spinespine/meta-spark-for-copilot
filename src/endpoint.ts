export const OFFICIAL_META_API_HOST = 'api.meta.ai';

export function isOfficialMetaBaseUrl(baseUrl: string): boolean {
	try {
		return new URL(baseUrl).hostname.toLowerCase() === OFFICIAL_META_API_HOST || new URL(baseUrl).hostname.toLowerCase().endsWith('.api.meta.ai') || new URL(baseUrl).hostname.toLowerCase() === 'api.meta.ai';
	} catch {
		return false;
	}
}

export function isOfficialDeepSeekBaseUrl(baseUrl: string): boolean {
	return isOfficialMetaBaseUrl(baseUrl);
}

export function normalizeBaseUrl(baseUrl: string): string {
	return baseUrl.trim().replace(/\/+$/u, '');
}
