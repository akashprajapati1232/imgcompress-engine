/**
 * @fileoverview Tests for JPEG strategy defaults and quality conversion.
 */

import { describe, it, expect } from 'vitest';
import {
  normalizedToMozJpegQuality,
  JPEG_DEFAULT_QUALITY,
  JPEG_MIN_QUALITY,
  JPEG_MAX_QUALITY,
} from '../src/strategies/jpeg/defaults.js';

describe('JPEG Strategy Defaults', () => {
  it('default quality is in [0, 1]', () => {
    expect(JPEG_DEFAULT_QUALITY).toBeGreaterThan(0);
    expect(JPEG_DEFAULT_QUALITY).toBeLessThanOrEqual(1);
  });

  it('min quality is less than max quality', () => {
    expect(JPEG_MIN_QUALITY).toBeLessThan(JPEG_MAX_QUALITY);
  });
});

describe('normalizedToMozJpegQuality', () => {
  it('converts 1.0 → 100', () => expect(normalizedToMozJpegQuality(1.0)).toBe(100));
  it('converts 0.0 → 0',   () => expect(normalizedToMozJpegQuality(0.0)).toBe(0));
  it('converts 0.8 → 80',  () => expect(normalizedToMozJpegQuality(0.8)).toBe(80));
  it('converts 0.82 → 82', () => expect(normalizedToMozJpegQuality(0.82)).toBe(82));
  it('clamps values above 1.0', () => expect(normalizedToMozJpegQuality(1.5)).toBe(100));
  it('clamps values below 0.0', () => expect(normalizedToMozJpegQuality(-0.5)).toBe(0));
});
