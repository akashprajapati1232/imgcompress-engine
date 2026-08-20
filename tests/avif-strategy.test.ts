/**
 * @fileoverview Tests for AVIF strategy defaults and quality conversion.
 */

import { describe, it, expect } from 'vitest';
import {
  normalizedToAvifCqLevel,
  avifCqLevelToNormalized,
  AVIF_MIN_CQ_LEVEL,
  AVIF_MAX_CQ_LEVEL,
  AVIF_DEFAULT_CQ_LEVEL,
} from '../src/strategies/avif/defaults.js';

describe('AVIF Strategy Defaults', () => {
  it('has valid CQ level bounds', () => {
    expect(AVIF_MIN_CQ_LEVEL).toBe(0);
    expect(AVIF_MAX_CQ_LEVEL).toBeLessThan(62);
    expect(AVIF_DEFAULT_CQ_LEVEL).toBeGreaterThan(AVIF_MIN_CQ_LEVEL);
    expect(AVIF_DEFAULT_CQ_LEVEL).toBeLessThan(AVIF_MAX_CQ_LEVEL);
  });
});

describe('normalizedToAvifCqLevel', () => {
  it('quality 1.0 → CQ 0 (best quality)', () => {
    expect(normalizedToAvifCqLevel(1.0)).toBe(0);
  });

  it('quality 0.0 → CQ 62 (worst quality)', () => {
    expect(normalizedToAvifCqLevel(0.0)).toBe(62);
  });

  it('quality 0.5 → CQ ~31', () => {
    expect(normalizedToAvifCqLevel(0.5)).toBe(31);
  });

  it('clamps above 1.0', () => {
    expect(normalizedToAvifCqLevel(1.5)).toBe(0);
  });

  it('clamps below 0.0', () => {
    expect(normalizedToAvifCqLevel(-0.5)).toBe(62);
  });
});

describe('avifCqLevelToNormalized', () => {
  it('CQ 0 → quality 1.0', () => {
    expect(avifCqLevelToNormalized(0)).toBe(1);
  });

  it('CQ 62 → quality 0.0', () => {
    expect(avifCqLevelToNormalized(62)).toBe(0);
  });

  it('is the inverse of normalizedToAvifCqLevel', () => {
    const quality = 0.75;
    const cq = normalizedToAvifCqLevel(quality);
    // Round-trip should be close (rounding may introduce tiny error)
    expect(Math.abs(avifCqLevelToNormalized(cq) - quality)).toBeLessThan(0.02);
  });
});
