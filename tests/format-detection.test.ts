/**
 * @fileoverview Tests for magic-byte based format detection.
 */

import { describe, it, expect } from 'vitest';
import { detectFormat, formatToMime, mimeToFormat } from '../src/analysis/format.js';
import { ImageCompressionError } from '../src/errors/ImageCompressionError.js';
import {
  JPEG_1x1,
  PNG_1x1,
  WEBP_1x1,
  AVIF_1x1,
  GIF_HEADER,
  BMP_HEADER,
  bufferToBlob,
} from './helpers/fixtures.js';

describe('detectFormat', () => {
  it('detects JPEG from magic bytes', async () => {
    const blob = bufferToBlob(JPEG_1x1, 'image/jpeg');
    const result = await detectFormat(blob);
    expect(result.format).toBe('jpeg');
    expect(result.mimeType).toBe('image/jpeg');
  });

  it('detects PNG from magic bytes', async () => {
    const blob = bufferToBlob(PNG_1x1, 'image/png');
    const result = await detectFormat(blob);
    expect(result.format).toBe('png');
    expect(result.mimeType).toBe('image/png');
  });

  it('detects WebP from RIFF/WEBP magic bytes', async () => {
    const blob = bufferToBlob(WEBP_1x1, 'image/webp');
    const result = await detectFormat(blob);
    expect(result.format).toBe('webp');
    expect(result.mimeType).toBe('image/webp');
  });

  it('detects AVIF from ftyp box', async () => {
    const blob = bufferToBlob(AVIF_1x1, 'image/avif');
    const result = await detectFormat(blob);
    expect(result.format).toBe('avif');
    expect(result.mimeType).toBe('image/avif');
  });

  it('does NOT trust file extension — detects based on magic bytes', async () => {
    // JPEG bytes but with a .png extension (wrong MIME)
    const blob = new File([JPEG_1x1], 'trick.png', { type: 'image/png' });
    const result = await detectFormat(blob);
    // Should detect JPEG from actual bytes
    expect(result.format).toBe('jpeg');
  });

  it('throws UNSUPPORTED_FORMAT for GIF', async () => {
    const blob = bufferToBlob(GIF_HEADER, 'image/gif');
    await expect(detectFormat(blob)).rejects.toMatchObject({
      code: 'UNSUPPORTED_FORMAT',
    });
  });

  it('throws UNSUPPORTED_FORMAT for BMP', async () => {
    const blob = bufferToBlob(BMP_HEADER, 'image/bmp');
    await expect(detectFormat(blob)).rejects.toMatchObject({
      code: 'UNSUPPORTED_FORMAT',
    });
  });

  it('throws INVALID_IMAGE for empty buffer', async () => {
    const blob = bufferToBlob(new ArrayBuffer(0), 'image/jpeg');
    await expect(detectFormat(blob)).rejects.toMatchObject({
      code: 'INVALID_IMAGE',
    });
  });
});

describe('formatToMime', () => {
  it('maps jpeg → image/jpeg', () => expect(formatToMime('jpeg')).toBe('image/jpeg'));
  it('maps png → image/png',  () => expect(formatToMime('png')).toBe('image/png'));
  it('maps webp → image/webp',() => expect(formatToMime('webp')).toBe('image/webp'));
  it('maps avif → image/avif',() => expect(formatToMime('avif')).toBe('image/avif'));
});

describe('mimeToFormat', () => {
  it('maps image/jpeg → jpeg', () => expect(mimeToFormat('image/jpeg')).toBe('jpeg'));
  it('maps image/jpg → jpeg',  () => expect(mimeToFormat('image/jpg')).toBe('jpeg'));
  it('maps image/png → png',   () => expect(mimeToFormat('image/png')).toBe('png'));
  it('maps image/webp → webp', () => expect(mimeToFormat('image/webp')).toBe('webp'));
  it('maps image/avif → avif', () => expect(mimeToFormat('image/avif')).toBe('avif'));
  it('returns null for unknown MIME', () => expect(mimeToFormat('image/gif')).toBeNull());
});
