/**
 * @fileoverview Tests for the optimizer utility functions.
 */

import { describe, it, expect } from 'vitest';
import { parseSizeToBytes, normalizeOptions } from '../src/core/Optimizer.js';

describe('parseSizeToBytes', () => {
  it('parses bare numbers as bytes', () => {
    expect(parseSizeToBytes(1024)).toBe(1024);
    expect(parseSizeToBytes(0.5)).toBe(1); // rounds
  });

  it('parses KB strings', () => {
    expect(parseSizeToBytes('100KB')).toBe(102400);
    expect(parseSizeToBytes('0.5KB')).toBe(512);
    expect(parseSizeToBytes('1KB')).toBe(1024);
  });

  it('parses MB strings', () => {
    expect(parseSizeToBytes('1MB')).toBe(1048576);
    expect(parseSizeToBytes('1.5MB')).toBe(1572864);
    expect(parseSizeToBytes('2MB')).toBe(2097152);
  });

  it('is case-insensitive for units', () => {
    expect(parseSizeToBytes('100kb')).toBe(102400);
    expect(parseSizeToBytes('1mb')).toBe(1048576);
  });

  it('handles whitespace', () => {
    expect(parseSizeToBytes('  100KB  ')).toBe(102400);
  });

  it('throws for invalid string', () => {
    expect(() => parseSizeToBytes('100TB')).toThrow();
    expect(() => parseSizeToBytes('abc')).toThrow();
    expect(() => parseSizeToBytes('')).toThrow();
  });

  it('throws for non-positive numbers', () => {
    expect(() => parseSizeToBytes(-100)).toThrow();
    expect(() => parseSizeToBytes(0)).toThrow();
    expect(() => parseSizeToBytes(Infinity)).toThrow();
  });
});

describe('normalizeOptions', () => {
  it('uses detected format as output format by default', () => {
    const opts = normalizeOptions('jpeg', {});
    expect(opts.outputFormat).toBe('jpeg');
  });

  it('uses provided outputFormat', () => {
    const opts = normalizeOptions('jpeg', { outputFormat: 'webp' });
    expect(opts.outputFormat).toBe('webp');
  });

  it('sets default quality range', () => {
    const opts = normalizeOptions('jpeg', {});
    expect(opts.qualityMin).toBe(0.10);
    expect(opts.qualityMax).toBe(0.92);
  });

  it('sets preserveAspectRatio to true by default', () => {
    const opts = normalizeOptions('jpeg', {});
    expect(opts.preserveAspectRatio).toBe(true);
  });

  it('sets transparency to "error" by default', () => {
    const opts = normalizeOptions('jpeg', {});
    expect(opts.transparency).toBe('error');
  });

  it('sets maxPixels to 40M by default', () => {
    const opts = normalizeOptions('jpeg', {});
    expect(opts.maxPixels).toBe(40_000_000);
  });

  it('passes through provided values', () => {
    const opts = normalizeOptions('png', {
      outputFormat: 'webp',
      maxWidth: 1920,
      maxHeight: 1080,
      maxPixels: 10_000_000,
      transparency: 'flatten',
    });
    expect(opts.outputFormat).toBe('webp');
    expect(opts.maxWidth).toBe(1920);
    expect(opts.maxHeight).toBe(1080);
    expect(opts.maxPixels).toBe(10_000_000);
    expect(opts.transparency).toBe('flatten');
  });
});
