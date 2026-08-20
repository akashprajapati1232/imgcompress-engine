/**
 * @fileoverview Tests for cancellation via AbortController.
 */

import { describe, it, expect } from 'vitest';
import { parseSizeToBytes } from '../src/core/Optimizer.js';
import { operationCancelled, isAbortError } from '../src/errors/ImageCompressionError.js';

describe('AbortController / cancellation', () => {
  it('operationCancelled produces correct error code', () => {
    const err = operationCancelled();
    expect(err.code).toBe('OPERATION_CANCELLED');
    expect(isAbortError(err)).toBe(true);
  });

  it('AbortController.signal.aborted is false before abort()', () => {
    const controller = new AbortController();
    expect(controller.signal.aborted).toBe(false);
  });

  it('AbortController.signal.aborted is true after abort()', () => {
    const controller = new AbortController();
    controller.abort();
    expect(controller.signal.aborted).toBe(true);
  });

  it('abort() can be called multiple times without error', () => {
    const controller = new AbortController();
    expect(() => {
      controller.abort();
      controller.abort();
      controller.abort();
    }).not.toThrow();
  });

  it('signal.addEventListener("abort") fires when abort() is called', () => {
    const controller = new AbortController();
    let fired = false;
    controller.signal.addEventListener('abort', () => { fired = true; }, { once: true });
    controller.abort();
    expect(fired).toBe(true);
  });
});

describe('parseSizeToBytes edge cases', () => {
  it('parses "500KB" to 512000', () => {
    expect(parseSizeToBytes('500KB')).toBe(512000);
  });

  it('parses "0.1MB" correctly', () => {
    expect(parseSizeToBytes('0.1MB')).toBe(Math.round(0.1 * 1024 * 1024));
  });
});
