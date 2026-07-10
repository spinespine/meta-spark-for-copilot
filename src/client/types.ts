import type { MetaRequest } from '../types';

export interface ErrorActionUrls {
	configureApiKey?: string;
	showLogs?: string;
}

export interface RequestErrorContext {
	baseUrl: string;
	request: MetaRequest;
}

export interface ErrorActionLink {
	labelKey: string;
	url: string;
}

export interface HttpErrorLinkDefinition {
	labelKey: string;
	url: string;
}

export type ApiProviderId = 'meta';
export type HttpErrorLinkStatusKey = 401 | 402 | '5xx';

export type MetaRequestErrorKind = 'http' | 'network' | 'unknown';

export type NetworkErrorCategory =
	| 'dns'
	| 'unreachable'
	| 'interrupted'
	| 'timeout'
	| 'tls'
	| 'aborted'
	| 'protocol'
	| 'configuration'
	| 'generic';
