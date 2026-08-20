/**
 * @fileoverview JPEG strategy defaults.
 */

import type { JpegEncodeOptions } from '../../encoders/WasmEncoder.js';

/** Default JPEG encoder options. Quality is set by the optimizer. */
export const JPEG_DEFAULTS: Omit<JpegEncodeOptions, 'quality'> = {
  progressive: true,
  optimize_coding: true,
  smoothing: 0,
  trellis_multipass: true,
  trellis_opt_zero: true,
  trellis_opt_table: false,
  trellis_loops: 1,
  auto_subsample: true,
  separate_chroma_quality: false,
  chroma_quality: 75,
};

/** Default quality for JPEG when no quality is specified. */
export const JPEG_DEFAULT_QUALITY = 0.82;

/** Minimum safe JPEG quality (below this, output is usually unusable). */
export const JPEG_MIN_QUALITY = 0.10;

/** Maximum JPEG quality (above this, file size grows without visible benefit). */
export const JPEG_MAX_QUALITY = 0.95;

/**
 * Convert normalized quality [0,1] to MozJPEG quality scale [0, 100].
 * MozJPEG quality 85 ≈ standard JPEG quality 95 visually.
 */
export function normalizedToMozJpegQuality(quality: number): number {
  return Math.round(Math.max(0, Math.min(1, quality)) * 100);
}
