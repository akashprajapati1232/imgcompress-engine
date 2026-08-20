/**
 * @fileoverview Tests for the error system.
 */

import { describe, it, expect } from 'vitest';
import {
  ImageCompressionError,
  unsupportedFormat,
  invalidImage,
  pixelLimitExceeded,
  operationCancelled,
  transparencyNotSupported,
  encoderUnavailable,
  compressionFailed,
  isAbortError,
  wrapUnknownError,
} from '../src/errors/ImageCompressionError.js';

describe('ImageCompressionError', () => {
  it('is an instance of Error', () => {
    const err = new ImageCompressionError('INVALID_IMAGE', 'test');
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(ImageCompressionError);
  });

  it('has the correct name', () => {
    const err = new ImageCompressionError('INVALID_IMAGE', 'test');
    expect(err.name).toBe('ImageCompressionError');
  });

  it('exposes code and message', () => {
    const err = new ImageCompressionError('UNSUPPORTED_FORMAT', 'msg', { format: 'gif' });
    expect(err.code).toBe('UNSUPPORTED_FORMAT');
    expect(err.message).toBe('msg');
    expect(err.details).toEqual({ format: 'gif' });
  });

  it('preserves prototype chain', () => {
    const err = new ImageCompressionError('CORRUPTED_IMAGE', 'test');
    expect(err instanceof ImageCompressionError).toBe(true);
  });
});

describe('Error factory helpers', () => {
  it('unsupportedFormat includes format in message', () => {
    const err = unsupportedFormat('gif');
    expect(err.code).toBe('UNSUPPORTED_FORMAT');
    expect(err.message).toContain('gif');
  });

  it('invalidImage includes reason when provided', () => {
    const err = invalidImage('file is empty');
    expect(err.code).toBe('INVALID_IMAGE');
    expect(err.message).toContain('file is empty');
  });

  it('invalidImage works without reason', () => {
    const err = invalidImage();
    expect(err.code).toBe('INVALID_IMAGE');
    expect(err.message.length).toBeGreaterThan(0);
  });

  it('pixelLimitExceeded includes pixel counts', () => {
    const err = pixelLimitExceeded(50_000_000, 40_000_000);
    expect(err.code).toBe('PIXEL_LIMIT_EXCEEDED');
    expect(err.message).toContain('50,000,000');
    expect(err.message).toContain('40,000,000');
    expect(err.details).toMatchObject({ pixels: 50_000_000, maxPixels: 40_000_000 });
  });

  it('operationCancelled has correct code', () => {
    const err = operationCancelled();
    expect(err.code).toBe('OPERATION_CANCELLED');
  });

  it('transparencyNotSupported includes formats', () => {
    const err = transparencyNotSupported('png', 'jpeg');
    expect(err.code).toBe('TRANSPARENCY_NOT_SUPPORTED');
    expect(err.message).toContain('png');
    expect(err.message).toContain('jpeg');
  });

  it('encoderUnavailable includes format', () => {
    const err = encoderUnavailable('avif');
    expect(err.code).toBe('ENCODER_UNAVAILABLE');
    expect(err.message).toContain('avif');
  });

  it('compressionFailed has correct code', () => {
    const err = compressionFailed('out of memory');
    expect(err.code).toBe('COMPRESSION_FAILED');
    expect(err.message).toContain('out of memory');
  });
});

describe('isAbortError', () => {
  it('returns true for ImageCompressionError with OPERATION_CANCELLED', () => {
    const err = operationCancelled();
    expect(isAbortError(err)).toBe(true);
  });

  it('returns true for native AbortError', () => {
    const err = new Error('User aborted');
    err.name = 'AbortError';
    expect(isAbortError(err)).toBe(true);
  });

  it('returns false for other errors', () => {
    expect(isAbortError(new Error('Something else'))).toBe(false);
    expect(isAbortError('string error')).toBe(false);
    expect(isAbortError(null)).toBe(false);
  });
});

describe('wrapUnknownError', () => {
  it('passes through ImageCompressionError unchanged', () => {
    const original = encoderUnavailable('webp');
    const wrapped = wrapUnknownError(original);
    expect(wrapped).toBe(original);
  });

  it('wraps plain Error', () => {
    const err = new Error('something broke');
    const wrapped = wrapUnknownError(err, 'COMPRESSION_FAILED');
    expect(wrapped).toBeInstanceOf(ImageCompressionError);
    expect(wrapped.code).toBe('COMPRESSION_FAILED');
    expect(wrapped.message).toBe('something broke');
  });

  it('wraps string errors', () => {
    const wrapped = wrapUnknownError('oops', 'DECODE_FAILED');
    expect(wrapped.code).toBe('DECODE_FAILED');
    expect(wrapped.message).toBe('oops');
  });
});
