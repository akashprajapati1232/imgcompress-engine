/**
 * @fileoverview analyzeImage — public API entry point for image analysis.
 */

import type { ImageAnalysis } from '../types/index.js';
import { analyzeImageFile } from '../analysis/ImageAnalyzer.js';
import { invalidImage } from '../errors/ImageCompressionError.js';

/**
 * Analyze an image file and return detailed metadata.
 *
 * Analysis reads only the file header and a canvas sample —
 * it does NOT fully decode the image into memory.
 *
 * @param file A File or Blob containing the image.
 * @returns Detailed image analysis.
 *
 * @throws {ImageCompressionError} INVALID_IMAGE — if the input is not a File or Blob.
 * @throws {ImageCompressionError} UNSUPPORTED_FORMAT — if the format is not supported.
 * @throws {ImageCompressionError} CORRUPTED_IMAGE — if the image cannot be decoded.
 *
 * @example
 * ```ts
 * const analysis = await analyzeImage(file);
 * console.log(analysis.format); // "jpeg"
 * console.log(analysis.width);  // 4032
 * console.log(analysis.hasAlpha); // false
 * ```
 */
export async function analyzeImage(file: File | Blob): Promise<ImageAnalysis> {
  if (!(file instanceof File) && !(file instanceof Blob)) {
    throw invalidImage('analyzeImage() requires a File or Blob instance.');
  }
  return analyzeImageFile(file);
}
