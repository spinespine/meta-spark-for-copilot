import { logger } from '../../logger';
export function logVisionProxyUnavailable(): void { logger.warn('No vision models available'); }
export function logVisionProxyDescribeFailed(_e: unknown): void {}
export function logVisionApiEndpointSelected(_id: string): void {}
export function logInvalidVisionProxyApiEndpointConfig(_a:any,_b:any,_c:any): void {}
export function logVSCodeVisionModelSelected(_m:any): void {}
export function logVSCodeVisionModelNotFound(_id:string): void {}
export function logVisionProxyTestSucceeded(_a:any,_b:any,_c:any): void {}
export function logVisionProxyTestFailed(_e:any): void {}
export function showVisionLogs(): void { logger.show(); }
