import { AbortController as PolyfillAbortController, AbortSignal as PolyfillAbortSignal } from 'abort-controller';

const target = globalThis as Record<string, unknown>;

if (typeof target.AbortController === 'undefined') target.AbortController = PolyfillAbortController as unknown;
if (typeof target.AbortSignal === 'undefined') target.AbortSignal = PolyfillAbortSignal as unknown;
