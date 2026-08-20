/**
 * @fileoverview Tests for WebP strategy defaults and quality conversion.
 */

import { describe, it, expect } from 'vitest';
import {
  normalizedToWebpQuality,
  WEBP_DEFAULT_QUALITY,
  WEBP_MIN_QUALITY,
  WEBP_MAX_QUALITY,
} from '../src/strategies/webp/defaults.js';

describe('WebP Strategy Defaults', () => {
  it('default quality is in [0, 1]', () => {
    expect(WEBP_DEFAULT_QUALITY).toBeGreaterThan(0);
    expect(WEBP_DEFAULT_QUALITY).toBeLessThanOrEqual(1);
  });

  it('min quality is less than max quality', () => {
    expect(WEBP_MIN_QUALITY).toBeLessThan(WEBP_MAX_QUALITY);
  });
});

describe('normalizedToWebpQuality', () => {
  it('converts 1.0 → 100', () => expect(normalizedToWebpQuality(1.0)).toBe(100));
  it('converts 0.0 → 0',   () => expect(normalizedToWebpQuality(0.0)).toBe(0));
  it('converts 0.8 → 80',  () => expect(normalizedToWebpQuality(0.8)).toBe(80));
  it('clamps values above 1.0', () => expect(normalizedToWebpQuality(1.5)).toBe(100));
  it('clamps values below 0.0', () => expect(normalizedToWebpQuality(-0.5)).toBe(0));
});
