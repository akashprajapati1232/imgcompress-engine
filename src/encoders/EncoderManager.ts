/**
 * @fileoverview EncoderManager — selects the best available encode/decode path.
 *
 * Priority order:
 *   1. WASM encoder (jSquash) — deterministic, preferred
 *   2. Native encoder (Canvas.toBlob) — browser-dependent quality
 *   3. Fallback encoder (same as native, but with warning)
 *
 * The caller never needs to know which encoder was selected.
 * Warnings from fallback paths are collected and passed to the result.
 */

import type { ImageFormat } from '../types/index.js';
import type { CompressionWarning } from '../types/index.js';
import { wasmDecode, wasmEncode, wasmOptimizePng, isWasmAvailable } from './WasmEncoder.js';
import type { WasmEncodeOptions, OxipngOptimizeOptions } from './WasmEncoder.js';
import { nativeDecode, nativeEncode } from './NativeEncoder.js';
import { fallbackDecode, fallbackEncode } from './FallbackEncoder.js';

// ---------------------------------------------------------------------------
// Encode result
// ---------------------------------------------------------------------------

export interface EncodeResult {
  buffer: ArrayBuffer;
  /** The encoder path that was used. */
  encoder: 'wasm' | 'native' | 'fallback';
  warnings: CompressionWarning[];
}

export interface DecodeResult {
  imageData: ImageData;
  encoder: 'wasm' | 'native' | 'fallback';
  warnings: CompressionWarning[];
}

// ---------------------------------------------------------------------------
// Manager
// ---------------------------------------------------------------------------

/**
 * Decode an image file or buffer to raw RGBA ImageData.
 *
 * Tries WASM first, falls back to native canvas decode.
 */
export async function decode(
  source: File | Blob | ArrayBuffer,
  format: ImageFormat,
): Promise<DecodeResult> {
  // Convert File/Blob to ArrayBuffer for WASM codecs
  const buffer =
    source instanceof ArrayBuffer
      ? source
      : await (source as File | Blob).arrayBuffer();

  if (isWasmAvailable()) {
    try {
      const imageData = await wasmDecode(buffer, format);
      return { imageData, encoder: 'wasm', warnings: [] };
    } catch {
      // WASM decode failed — fall through to native
    }
  }

  // Native decode from original file/blob
  const file =
    source instanceof ArrayBuffer
      ? new Blob([source])
      : source;

  try {
    const imageData = await nativeDecode(file);
    return {
      imageData,
      encoder: 'native',
      warnings: [
        {
          code: 'ENCODER_FALLBACK',
          message: `WASM decode failed for ${format}; using native canvas decode.`,
        },
      ],
    };
  } catch {
    const imageData = await fallbackDecode(file);
    return {
      imageData,
      encoder: 'fallback',
      warnings: [
        {
          code: 'ENCODER_FALLBACK',
          message: `Fallback canvas decode used for ${format}.`,
        },
      ],
    };
  }
}

/**
 * Encode RGBA ImageData to the given format.
 *
 * Tries WASM first, falls back to native Canvas, then fallback encoder.
 *
 * @param imageData RGBA pixel data.
 * @param format Target format.
 * @param options Format-specific encoder options.
 * @param qualityNormalized Normalized quality in [0, 1] for fallback encoder.
 */
export async function encode(
  imageData: ImageData,
  format: ImageFormat,
  options: WasmEncodeOptions,
  qualityNormalized: number,
): Promise<EncodeResult> {
  if (isWasmAvailable()) {
    try {
      const buffer = await wasmEncode(imageData, format, options);
      return { buffer, encoder: 'wasm', warnings: [] };
    } catch {
      // WASM encode failed — fall through
    }
  }

  // Native canvas fallback
  try {
    const buffer = await nativeEncode(imageData, format, qualityNormalized);
    return {
      buffer,
      encoder: 'native',
      warnings: [
        {
          code: 'ENCODER_FALLBACK',
          message: `WASM encode failed for ${format}; using native canvas encoder.`,
        },
      ],
    };
  } catch {
    const result = await fallbackEncode(imageData, format, qualityNormalized);
    return { buffer: result.buffer, encoder: 'fallback', warnings: result.warnings };
  }
}

/**
 * Optimize a PNG buffer using Oxipng (lossless).
 * If Oxipng is unavailable, returns the original buffer unchanged with a warning.
 */
export async function optimizePng(
  buffer: ArrayBuffer,
  options: OxipngOptimizeOptions = {},
): Promise<EncodeResult> {
  if (isWasmAvailable()) {
    try {
      const optimized = await wasmOptimizePng(buffer, options);
      return { buffer: optimized, encoder: 'wasm', warnings: [] };
    } catch {
      // Fall through — return original
    }
  }

  return {
    buffer,
    encoder: 'fallback',
    warnings: [
      {
        code: 'ENCODER_FALLBACK',
        message: 'Oxipng WASM optimizer unavailable; PNG returned without lossless optimization.',
      },
    ],
  };
}
