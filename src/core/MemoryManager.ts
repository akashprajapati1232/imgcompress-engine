/**
 * @fileoverview MemoryManager — tracks and enforces pixel/memory limits.
 *
 * Large images decoded to raw RGBA consume far more RAM than their
 * compressed file size suggests:
 *
 *   8000 × 6000 × 4 bytes = 192 MB
 *
 * The MemoryManager:
 *   1. Enforces a configurable maxPixels limit before decode.
 *   2. Tracks allocated ImageData instances.
 *   3. Provides explicit release() to clear references.
 */

import { pixelLimitExceeded } from '../errors/ImageCompressionError.js';

/** Default maximum pixel count (40 megapixels). */
export const DEFAULT_MAX_PIXELS = 40_000_000;

export class MemoryManager {
  private readonly maxPixels: number;
  private allocations: Set<ImageData> = new Set();

  constructor(maxPixels = DEFAULT_MAX_PIXELS) {
    this.maxPixels = maxPixels;
  }

  /**
   * Check that the image dimensions are within the pixel limit.
   * Call this BEFORE decoding to avoid OOM from large images.
   *
   * @throws {ImageCompressionError} PIXEL_LIMIT_EXCEEDED
   */
  checkPixelLimit(width: number, height: number): void {
    const pixels = width * height;
    if (pixels > this.maxPixels) {
      throw pixelLimitExceeded(pixels, this.maxPixels);
    }
  }

  /**
   * Track an ImageData allocation.
   * This is informational — JS does not expose a free() API.
   */
  track(imageData: ImageData): ImageData {
    this.allocations.add(imageData);
    return imageData;
  }

  /**
   * Release a tracked ImageData reference.
   * The GC will collect it when no other references remain.
   */
  release(imageData: ImageData): void {
    this.allocations.delete(imageData);
  }

  /**
   * Release all tracked ImageData references.
   */
  releaseAll(): void {
    this.allocations.clear();
  }

  /**
   * Approximate current tracked memory usage in bytes.
   * (width × height × 4 bytes per pixel for RGBA)
   */
  get approximateUsageBytes(): number {
    let total = 0;
    for (const img of this.allocations) {
      total += img.width * img.height * 4;
    }
    return total;
  }
}
