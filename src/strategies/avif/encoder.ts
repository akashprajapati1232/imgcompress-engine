/**
 * @fileoverview AVIF encoder.
 */

import type { EncodeResult } from '../../encoders/EncoderManager.js';
import { encode as encoderEncode } from '../../encoders/EncoderManager.js';
import { AVIF_DEFAULTS, normalizedToAvifCqLevel } from './defaults.js';

/**
 * Encode ImageData as AVIF at the given quality.
 *
 * @param imageData RGBA pixel data.
 * @param quality Normalized quality in [0, 1].
 */
export async function encodeAvif(
  imageData: ImageData,
  quality: number,
): Promise<EncodeResult> {
  const cqLevel = normalizedToAvifCqLevel(quality);
  return encoderEncode(
    imageData,
    'avif',
    { ...AVIF_DEFAULTS, cqLevel },
    quality,
  );
}
