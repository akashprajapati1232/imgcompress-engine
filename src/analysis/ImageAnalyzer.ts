/**
 * @fileoverview ImageAnalyzer — orchestrates all analysis sub-modules.
 *
 * Analysis pipeline:
 *   detectFormat → extractDimensions → detectAlpha → detectAnimation
 *
 * All operations run in parallel where possible.
 */

import type { ImageAnalysis } from '../types/index.js';
import { detectFormat } from './format.js';
import { extractDimensions } from './dimensions.js';
import { detectAlpha } from './alpha.js';
import { detectAnimation } from './animation.js';
import { invalidImage } from '../errors/ImageCompressionError.js';

/**
 * Fully analyze an image file, returning format, dimensions, alpha,
 * and animation information.
 *
 * @throws {ImageCompressionError} On invalid, corrupted, or unsupported input.
 */
export async function analyzeImageFile(file: File | Blob): Promise<ImageAnalysis> {
  if (!(file instanceof File) && !(file instanceof Blob)) {
    throw invalidImage('Input must be a File or Blob instance.');
  }

  if (file.size === 0) {
    throw invalidImage('File is empty (0 bytes).');
  }

  // Phase 1: format detection (fast, reads only 64 bytes)
  const { format, mimeType } = await detectFormat(file);

  // Phase 2: Run dimension, alpha, animation analysis in parallel
  const [dimensions, hasAlpha, animationInfo] = await Promise.all([
    extractDimensions(file),
    detectAlpha(file, format),
    detectAnimation(file, format),
  ]);

  const result: ImageAnalysis = {
    format,
    mimeType,
    fileSize: file.size,
    width: dimensions.width,
    height: dimensions.height,
    aspectRatio: dimensions.aspectRatio,
    hasAlpha,
    animated: animationInfo.animated,
  };

  if (animationInfo.frameCount !== undefined) {
    result.frameCount = animationInfo.frameCount;
  }

  return result;
}
