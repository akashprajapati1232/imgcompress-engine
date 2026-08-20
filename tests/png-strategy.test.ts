/**
 * @fileoverview Tests for PNG strategy defaults.
 */

import { describe, it, expect } from 'vitest';
import {
  PNG_DEFAULT_LEVEL,
  PNG_MIN_OXIPNG_LEVEL,
  PNG_MAX_OXIPNG_LEVEL,
  PNG_ENCODE_DEFAULTS,
  OXIPNG_DEFAULTS,
} from '../src/strategies/png/defaults.js';

describe('PNG Strategy Defaults', () => {
  it('has valid compression level range', () => {
    expect(PNG_MIN_OXIPNG_LEVEL).toBeGreaterThanOrEqual(1);
    expect(PNG_MAX_OXIPNG_LEVEL).toBeLessThanOrEqual(6);
    expect(PNG_MIN_OXIPNG_LEVEL).toBeLessThan(PNG_MAX_OXIPNG_LEVEL);
  });

  it('default level is within valid range', () => {
    expect(PNG_DEFAULT_LEVEL).toBeGreaterThanOrEqual(PNG_MIN_OXIPNG_LEVEL);
    expect(PNG_DEFAULT_LEVEL).toBeLessThanOrEqual(PNG_MAX_OXIPNG_LEVEL);
  });

  it('encode defaults are an object', () => {
    expect(PNG_ENCODE_DEFAULTS).toBeTypeOf('object');
  });

  it('oxipng defaults enable alpha optimization', () => {
    expect(OXIPNG_DEFAULTS.optimiseAlpha).toBe(true);
  });

  it('oxipng defaults do not enable interlace', () => {
    expect(OXIPNG_DEFAULTS.interlace).toBe(false);
  });
});
