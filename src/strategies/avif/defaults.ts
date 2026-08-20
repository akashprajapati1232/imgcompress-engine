/**
 * @fileoverview AVIF strategy defaults.
 *
 * AVIF quality is controlled by CQ (Constant Quality) level, where
 * 0 = best quality / largest file and 62 = worst quality / smallest file.
 * This is inverted compared to JPEG/WebP where higher = better.
 */

import type { AvifEncodeOptions } from '../../encoders/WasmEncoder.js';

/** Default AVIF encode options. cqLevel is set by the optimizer. */
export const AVIF_DEFAULTS: Omit<AvifEncodeOptions, 'cqLevel'> = {
  speed: 6,     // 0 = best quality (slow), 10 = fastest (lower quality)
  subsample: 1, // YUV 4:2:0
};

/** Default AVIF CQ level (0–62; lower = better quality). */
export const AVIF_DEFAULT_CQ_LEVEL = 33;

/**
 * Convert normalized quality [0, 1] to AVIF CQ level [0, 62].
 * quality=1 → cqLevel=0 (best), quality=0 → cqLevel=62 (worst).
 */
export function normalizedToAvifCqLevel(quality: number): number {
  const q = Math.max(0, Math.min(1, quality));
  return Math.round((1 - q) * 62);
}

/**
 * Convert AVIF CQ level back to normalized quality.
 */
export function avifCqLevelToNormalized(cqLevel: number): number {
  return 1 - cqLevel / 62;
}

/** Best (lowest) CQ level for AVIF (highest quality). */
export const AVIF_MIN_CQ_LEVEL = 0;

/** Worst (highest) CQ level allowed (limits degradation). */
export const AVIF_MAX_CQ_LEVEL = 55;
