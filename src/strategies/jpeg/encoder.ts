/**
 * @fileoverview JPEG encoder — wraps EncoderManager for JPEG-specific encoding.
 */

import type { EncodeResult } from '../../encoders/EncoderManager.js';
import { encode as encoderEncode } from '../../encoders/EncoderManager.js';
import { JPEG_DEFAULTS, normalizedToMozJpegQuality } from './defaults.js';

/**
 * Encode ImageData as JPEG at the given quality.
 *
 * @param imageData RGBA pixel data.
 * @param quality Normalized quality in [0, 1].
 */
export async function encodeJpeg(
  imageData: ImageData,
  quality: number,
): Promise<EncodeResult> {
  const mozQuality = normalizedToMozJpegQuality(quality);
  return encoderEncode(
    imageData,
    'jpeg',
    { ...JPEG_DEFAULTS, quality: mozQuality },
    quality,
  );
}
