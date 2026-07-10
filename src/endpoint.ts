export const OFFICIAL_META_API_HOST = 'api.meta.ai';

export function isOfficialMetaBaseUrl(baseUrl: string): boolean {
	try {
		const hostname = new URL(baseUrl).hostname.toLowerCase();
		return hostname === OFFICIAL_META_API_HOST || hostname.endsWith(`.${OFFICIAL_META_API_HOST}`);
	} catch {
		return false;
	}
}

export function normalizeBaseUrl(baseUrl: string): string {
	return baseUrl.trim().replace(/\/+$/u, '');
}
