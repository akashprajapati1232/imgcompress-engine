/**
 * @fileoverview JPEG optimizer — binary search quality for target file size.
 */

import type { CompressionWarning } from '../../types/index.js';
import { encodeJpeg } from './encoder.js';
import { JPEG_MIN_QUALITY, JPEG_MAX_QUALITY } from './defaults.js';

export interface JpegOptimizeOptions {
  targetSizeBytes: number;
  qualityMin?: number;
  qualityMax?: number;
  maxIterations?: number;
  sizeTolerance?: number;
}

export interface JpegOptimizeResult {
  buffer: ArrayBuffer;
  quality: number;
  achievedTarget: boolean;
  warnings: CompressionWarning[];
}

/**
 * Binary-search JPEG quality to approach a target file size.
 *
 * Algorithm:
 *   1. Start with an initial probe at qualityMax.
 *   2. Binary-search the quality range until output size is within
 *      sizeTolerance of targetSizeBytes or maxIterations is reached.
 *   3. Always return the best result found (closest to target from below).
 *
 * @param imageData RGBA ImageData to encode.
 * @param options Optimization parameters.
 */
export async function optimizeJpegToTargetSize(
  imageData: ImageData,
  options: JpegOptimizeOptions,
): Promise<JpegOptimizeResult> {
  const {
    targetSizeBytes,
    qualityMin = JPEG_MIN_QUALITY,
    qualityMax = JPEG_MAX_QUALITY,
    maxIterations = 12,
    sizeTolerance = 0.05,
  } = options;

  const warnings: CompressionWarning[] = [];

  let lo = qualityMin;
  let hi = qualityMax;
  let bestBuffer: ArrayBuffer | null = null;
  let bestQuality = hi;
  let bestSize = Infinity;
  let achievedTarget = false;

  for (let i = 0; i < maxIterations; i++) {
    const mid = (lo + hi) / 2;

    const result = await encodeJpeg(imageData, mid);
    const size = result.buffer.byteLength;

    // Update best: prefer the largest output that is ≤ target
    if (size <= targetSizeBytes) {
      if (bestBuffer === null || size > bestSize) {
        bestBuffer = result.buffer;
        bestQuality = mid;
        bestSize = size;
      }
    }

    // Check if we're within tolerance
    const relativeError = Math.abs(size - targetSizeBytes) / targetSizeBytes;
    if (relativeError <= sizeTolerance) {
      bestBuffer = result.buffer;
      bestQuality = mid;
      bestSize = size;
      achievedTarget = true;
      break;
    }

    // Binary search step
    if (size > targetSizeBytes) {
      hi = mid;
    } else {
      lo = mid;
    }

    // Convergence guard
    if (hi - lo < 0.005) break;
  }

  // If no candidate was ≤ target, use the last low-quality result
  if (bestBuffer === null) {
    const result = await encodeJpeg(imageData, lo);
    bestBuffer = result.buffer;
    bestQuality = lo;
    bestSize = result.buffer.byteLength;
  }

  if (!achievedTarget) {
    warnings.push({
      code: 'TARGET_SIZE_NOT_REACHED',
      message:
        `Could not reach target size of ${targetSizeBytes} bytes for JPEG. ` +
        `Best result: ${bestSize} bytes at quality ${bestQuality.toFixed(3)}.`,
    });
  }

  if (bestQuality <= qualityMin + 0.01) {
    warnings.push({
      code: 'QUALITY_CLAMPED',
      message: `JPEG quality hit minimum bound (${qualityMin}). Output may show artifacts.`,
    });
  }

  return {
    buffer: bestBuffer,
    quality: bestQuality,
    achievedTarget,
    warnings,
  };
}
