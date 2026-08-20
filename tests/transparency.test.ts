/**
 * @fileoverview Tests for transparency handling (flattenAlpha, policies).
 */

import { describe, it, expect } from 'vitest';
import { flattenAlpha } from '../src/metadata/MetadataManager.js';
import { transparencyNotSupported } from '../src/errors/ImageCompressionError.js';

function makeTransparentImageData(width: number, height: number): ImageData {
  const data = new ImageData(width, height);
  // Fill with semi-transparent red
  for (let i = 0; i < data.data.length; i += 4) {
    data.data[i]     = 255; // R
    data.data[i + 1] = 0;   // G
    data.data[i + 2] = 0;   // B
    data.data[i + 3] = 128; // A (semi-transparent)
  }
  return data;
}

function makeOpaqueImageData(width: number, height: number): ImageData {
  const data = new ImageData(width, height);
  for (let i = 0; i < data.data.length; i += 4) {
    data.data[i]     = 0;
    data.data[i + 1] = 128;
    data.data[i + 2] = 255;
    data.data[i + 3] = 255; // fully opaque
  }
  return data;
}

describe('flattenAlpha', () => {
  it('returns a new ImageData with alpha = 255 everywhere', () => {
    const src = makeTransparentImageData(4, 4);
    const result = flattenAlpha(src, [255, 255, 255]);

    for (let i = 3; i < result.data.length; i += 4) {
      expect(result.data[i]).toBe(255);
    }
  });

  it('composites semi-transparent red onto white background', () => {
    const src = new ImageData(1, 1);
    src.data[0] = 255; // R
    src.data[1] = 0;   // G
    src.data[2] = 0;   // B
    src.data[3] = 128; // A (≈50%)

    const result = flattenAlpha(src, [255, 255, 255]);

    // Expected: R ≈ 255*0.5 + 255*0.5 ≈ 255
    expect(result.data[0]).toBeGreaterThan(200);
    // Expected: G ≈ 0*0.5 + 255*0.5 ≈ 127
    expect(result.data[1]).toBeGreaterThan(100);
    expect(result.data[1]).toBeLessThan(160);
    // Alpha is always 255
    expect(result.data[3]).toBe(255);
  });

  it('preserves fully opaque pixels unchanged (RGB)', () => {
    const src = makeOpaqueImageData(2, 2);
    const result = flattenAlpha(src, [255, 255, 255]);

    // Opaque pixels composited on white background:
    // result = pixel * 1.0 + white * 0.0 = pixel
    expect(result.data[0]).toBe(0);   // R
    expect(result.data[1]).toBe(128); // G
    expect(result.data[2]).toBe(255); // B
    expect(result.data[3]).toBe(255); // A
  });

  it('uses the provided background color', () => {
    const src = new ImageData(1, 1);
    src.data[0] = 0;   // R
    src.data[1] = 0;   // G
    src.data[2] = 0;   // B
    src.data[3] = 0;   // A (fully transparent)

    // Fully transparent → should show only background
    const result = flattenAlpha(src, [0, 128, 255]);
    expect(result.data[0]).toBe(0);
    expect(result.data[1]).toBe(128);
    expect(result.data[2]).toBe(255);
    expect(result.data[3]).toBe(255);
  });
});

describe('Transparency policy error', () => {
  it('transparencyNotSupported creates correct error', () => {
    const err = transparencyNotSupported('png', 'jpeg');
    expect(err.code).toBe('TRANSPARENCY_NOT_SUPPORTED');
    expect(err.message).toContain('png');
    expect(err.message).toContain('jpeg');
    expect(err.message).toContain('flatten');
  });
});
