/**
 * @fileoverview Tests for ResizeEngine utilities.
 */

import { describe, it, expect } from 'vitest';
import {
  computeTargetDimensions,
  needsResize,
} from '../src/resize/ResizeEngine.js';

describe('computeTargetDimensions', () => {
  it('returns original dims when no constraints', () => {
    const result = computeTargetDimensions({ width: 4000, height: 3000 }, {});
    expect(result).toEqual({ width: 4000, height: 3000 });
  });

  it('scales down by maxWidth preserving aspect ratio', () => {
    const result = computeTargetDimensions(
      { width: 4000, height: 3000 },
      { maxWidth: 1920, preserveAspectRatio: true },
    );
    expect(result.width).toBe(1920);
    expect(result.height).toBe(1440); // 3000 * (1920/4000)
  });

  it('scales down by maxHeight preserving aspect ratio', () => {
    const result = computeTargetDimensions(
      { width: 4000, height: 3000 },
      { maxHeight: 1080, preserveAspectRatio: true },
    );
    expect(result.height).toBe(1080);
    expect(result.width).toBe(1440); // 4000 * (1080/3000)
  });

  it('scales to the more restrictive constraint', () => {
    const result = computeTargetDimensions(
      { width: 4000, height: 3000 },
      { maxWidth: 2000, maxHeight: 1080, preserveAspectRatio: true },
    );
    // maxHeight is more restrictive: scale = 1080/3000 = 0.36
    expect(result.height).toBeLessThanOrEqual(1080);
    expect(result.width).toBeLessThanOrEqual(2000);
  });

  it('does not scale up (never upscales)', () => {
    const result = computeTargetDimensions(
      { width: 100, height: 100 },
      { maxWidth: 4000, maxHeight: 4000, preserveAspectRatio: true },
    );
    // Image is smaller than constraint — should not upscale
    expect(result).toEqual({ width: 100, height: 100 });
  });

  it('applies maxDimension to both width and height', () => {
    const result = computeTargetDimensions(
      { width: 4000, height: 3000 },
      { maxDimension: 1920, preserveAspectRatio: true },
    );
    expect(result.width).toBeLessThanOrEqual(1920);
    expect(result.height).toBeLessThanOrEqual(1920);
  });

  it('produces minimum 1x1 output', () => {
    const result = computeTargetDimensions(
      { width: 1, height: 1 },
      { maxWidth: 1, maxHeight: 1 },
    );
    expect(result.width).toBeGreaterThanOrEqual(1);
    expect(result.height).toBeGreaterThanOrEqual(1);
  });
});

describe('needsResize', () => {
  it('returns true when image exceeds maxWidth', () => {
    expect(needsResize({ width: 2000, height: 1000 }, { maxWidth: 1920 })).toBe(true);
  });

  it('returns false when image is within maxWidth', () => {
    expect(needsResize({ width: 1920, height: 1000 }, { maxWidth: 1920 })).toBe(false);
  });

  it('returns false when no constraints given', () => {
    expect(needsResize({ width: 99999, height: 99999 }, {})).toBe(false);
  });

  it('returns true when maxDimension exceeded', () => {
    expect(needsResize({ width: 4000, height: 3000 }, { maxDimension: 3000 })).toBe(true);
  });
});
