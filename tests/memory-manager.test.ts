/**
 * @fileoverview Tests for MemoryManager.
 */

import { describe, it, expect } from 'vitest';
import { MemoryManager, DEFAULT_MAX_PIXELS } from '../src/core/MemoryManager.js';
import { ImageCompressionError } from '../src/errors/ImageCompressionError.js';

function makeImageData(width: number, height: number): ImageData {
  return new ImageData(width, height);
}

describe('MemoryManager', () => {
  it('has a default maxPixels of 40M', () => {
    expect(DEFAULT_MAX_PIXELS).toBe(40_000_000);
  });

  it('does not throw for images within pixel limit', () => {
    const mm = new MemoryManager(40_000_000);
    expect(() => mm.checkPixelLimit(1920, 1080)).not.toThrow();
    expect(() => mm.checkPixelLimit(4032, 3024)).not.toThrow();
  });

  it('throws PIXEL_LIMIT_EXCEEDED for images exceeding limit', () => {
    const mm = new MemoryManager(1_000_000);
    expect(() => mm.checkPixelLimit(2000, 1000)).toThrowError(
      expect.objectContaining({ code: 'PIXEL_LIMIT_EXCEEDED' }),
    );
  });

  it('exactly at the limit is allowed', () => {
    const mm = new MemoryManager(1_000_000);
    expect(() => mm.checkPixelLimit(1000, 1000)).not.toThrow(); // exactly 1M
  });

  it('tracks and releases ImageData', () => {
    const mm = new MemoryManager();
    const img = makeImageData(100, 100);
    mm.track(img);
    expect(mm.approximateUsageBytes).toBe(100 * 100 * 4);
    mm.release(img);
    expect(mm.approximateUsageBytes).toBe(0);
  });

  it('releaseAll clears all tracked allocations', () => {
    const mm = new MemoryManager();
    mm.track(makeImageData(100, 100));
    mm.track(makeImageData(200, 200));
    expect(mm.approximateUsageBytes).toBeGreaterThan(0);
    mm.releaseAll();
    expect(mm.approximateUsageBytes).toBe(0);
  });

  it('allows custom maxPixels via constructor', () => {
    const mm = new MemoryManager(100);
    expect(() => mm.checkPixelLimit(11, 10)).toThrow(); // 110 > 100
    expect(() => mm.checkPixelLimit(10, 10)).not.toThrow(); // exactly 100
  });
});
