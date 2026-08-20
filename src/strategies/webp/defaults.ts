/**
 * @fileoverview WebP strategy defaults.
 */

import type { WebpEncodeOptions } from '../../encoders/WasmEncoder.js';

/** Default WebP encoder options. Quality is set by the optimizer. */
export const WEBP_DEFAULTS: Omit<WebpEncodeOptions, 'quality'> = {
  method: 4,
  lossless: 0,
  alpha_compression: 1,
  alpha_filtering: 1,
  alpha_quality: 100,
  pass: 1,
  filter_type: 1,
  autofilter: 0,
  use_sharp_yuv: 0,
};

/** Default WebP quality when none is specified. */
export const WEBP_DEFAULT_QUALITY = 0.80;

/** Minimum WebP quality for lossy output. */
export const WEBP_MIN_QUALITY = 0.10;

/** Maximum WebP quality. */
export const WEBP_MAX_QUALITY = 0.95;

/**
 * Convert normalized quality [0, 1] to WebP quality [0, 100].
 */
export function normalizedToWebpQuality(quality: number): number {
  return Math.round(Math.max(0, Math.min(1, quality)) * 100);
}
