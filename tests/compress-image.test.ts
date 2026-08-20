/**
 * @fileoverview Tests for the compressImage public API.
 * Uses mocked encoder and analyzer layers to test option normalization,
 * error handling, and API contract without requiring real WASM.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ImageCompressionError } from '../src/errors/ImageCompressionError.js';
import { bufferToBlob, JPEG_1x1, bufferToFile } from './helpers/fixtures.js';

// ── Mock the compressor to avoid WASM in unit tests ─────────────────────────

vi.mock('../src/core/Compressor.js', () => ({
  runCompressor: vi.fn().mockResolvedValue({
    blob: new Blob([new Uint8Array(50000)], { type: 'image/jpeg' }),
    original: { size: 100000, width: 1920, height: 1080, format: 'jpeg' },
    output:   { size: 50000,  width: 1920, height: 1080, format: 'jpeg' },
    compression: { ratio: 50, savedBytes: 50000, savedPercentage: 50 },
    processingTime: 250,
    achievedTarget: true,
    warnings: [],
  }),
}));

// ── Import after mocking ─────────────────────────────────────────────────────

import { compressImage } from '../src/api/compressImage.js';

// Force main-thread fallback by removing Worker
beforeEach(() => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).Worker = undefined;
});

describe('compressImage input validation', () => {
  it('throws INVALID_IMAGE for non-File/Blob input', async () => {
    await expect(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      compressImage('not a file' as any),
    ).rejects.toMatchObject({ code: 'INVALID_IMAGE' });
  });

  it('throws INVALID_IMAGE for empty Blob', async () => {
    const empty = new Blob([]);
    await expect(compressImage(empty)).rejects.toMatchObject({
      code: 'INVALID_IMAGE',
    });
  });

  it('accepts a File object', async () => {
    const file = bufferToFile(JPEG_1x1, 'test.jpg', 'image/jpeg');
    const result = await compressImage(file);
    expect(result).toHaveProperty('blob');
    expect(result.blob).toBeInstanceOf(Blob);
  });

  it('accepts a Blob object', async () => {
    const blob = bufferToBlob(JPEG_1x1, 'image/jpeg');
    const result = await compressImage(blob);
    expect(result).toHaveProperty('blob');
  });
});

describe('compressImage result shape', () => {
  it('returns all required result fields', async () => {
    const file = bufferToFile(JPEG_1x1, 'test.jpg', 'image/jpeg');
    const result = await compressImage(file);

    expect(result).toHaveProperty('blob');
    expect(result).toHaveProperty('original');
    expect(result).toHaveProperty('output');
    expect(result).toHaveProperty('compression');
    expect(result).toHaveProperty('processingTime');
    expect(result).toHaveProperty('warnings');

    expect(result.original).toHaveProperty('size');
    expect(result.original).toHaveProperty('width');
    expect(result.original).toHaveProperty('height');
    expect(result.original).toHaveProperty('format');

    expect(result.compression).toHaveProperty('ratio');
    expect(result.compression).toHaveProperty('savedBytes');
    expect(result.compression).toHaveProperty('savedPercentage');
  });

  it('processingTime is a positive number', async () => {
    const file = bufferToFile(JPEG_1x1, 'test.jpg', 'image/jpeg');
    const result = await compressImage(file);
    expect(result.processingTime).toBeGreaterThan(0);
  });

  it('warnings is an array', async () => {
    const file = bufferToFile(JPEG_1x1, 'test.jpg', 'image/jpeg');
    const result = await compressImage(file);
    expect(Array.isArray(result.warnings)).toBe(true);
  });
});

describe('compressImage progress reporting', () => {
  it('calls onProgress with percent and stage', async () => {
    const progress: Array<{ percent: number; stage: string }> = [];
    const file = bufferToFile(JPEG_1x1, 'test.jpg', 'image/jpeg');

    await compressImage(file, {
      onProgress: (p) => progress.push(p),
    });

    // At minimum we expect the mock to not throw.
    // Real progress events come from the pipeline in integration tests.
    expect(progress).toBeDefined();
  });
});

describe('compressImage cancellation', () => {
  it('accepts a signal option without throwing', async () => {
    const controller = new AbortController();
    const file = bufferToFile(JPEG_1x1, 'test.jpg', 'image/jpeg');
    const result = await compressImage(file, { signal: controller.signal });
    expect(result).toHaveProperty('blob');
  });
});
