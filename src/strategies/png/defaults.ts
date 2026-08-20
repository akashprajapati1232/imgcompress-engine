/**
 * @fileoverview PNG strategy defaults.
 *
 * PNG is a lossless format. Unlike JPEG, "quality" does not degrade
 * visual output — only compression level affects file size (slowly).
 * The primary size optimization path for PNG is Oxipng lossless optimization.
 */

import type { PngEncodeOptions, OxipngOptimizeOptions } from '../../encoders/WasmEncoder.js';

/** Default PNG encode options (compression level 6 = best). */
export const PNG_ENCODE_DEFAULTS: PngEncodeOptions = {};

/** Default Oxipng optimization options. */
export const OXIPNG_DEFAULTS: OxipngOptimizeOptions = {
  level: 4,
  interlace: false,
  optimiseAlpha: true,
};

/** Default PNG compression level. */
export const PNG_DEFAULT_LEVEL = 6;

/** Minimum Oxipng optimization level (faster, less compression). */
export const PNG_MIN_OXIPNG_LEVEL = 1;

/** Maximum Oxipng optimization level (slower, most compression). */
export const PNG_MAX_OXIPNG_LEVEL = 6;
