/**
 * @fileoverview getCapabilities — public API for browser capability detection.
 */

import type { BrowserCapabilities } from '../types/index.js';
import { detectCapabilities } from '../capabilities/BrowserCapabilities.js';

/**
 * Detect and return the current browser's image processing capabilities.
 *
 * Results are cached after the first call.
 *
 * @returns A snapshot of what the browser can do right now.
 *
 * @example
 * ```ts
 * const caps = await getCapabilities();
 *
 * if (!caps.wasm) {
 *   console.warn('WebAssembly unavailable — quality may be limited.');
 * }
 *
 * if (!caps.decode.avif) {
 *   console.log('Browser cannot display AVIF natively.');
 * }
 * ```
 */
export async function getCapabilities(): Promise<BrowserCapabilities> {
  return detectCapabilities();
}
