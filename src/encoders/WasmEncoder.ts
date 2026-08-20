/**
 * @fileoverview WASM Encoder — lazy-loading adapters around @jsquash codecs.
 *
 * Each codec is loaded on first use. Never loading unused codecs keeps
 * bundle size minimal and avoids initializing WASM for formats that
 * the caller does not need.
 *
 * The decode/encode interface is format-agnostic — the caller passes
 * the format and this module routes to the correct jSquash package.
 */

import type { ImageFormat } from '../types/index.js';
import {
  encoderUnavailable,
  decodeFailed,
  compressionFailed,
  wrapUnknownError,
} from '../errors/ImageCompressionError.js';

// ---------------------------------------------------------------------------
// Codec-specific option types
// ---------------------------------------------------------------------------

export interface JpegEncodeOptions {
  quality: number; // 0–100 (MozJPEG scale)
  progressive?: boolean;
  optimize_coding?: boolean;
  smoothing?: number;
  color_space?: number;
  quant_table?: number;
  trellis_multipass?: boolean;
  trellis_opt_zero?: boolean;
  trellis_opt_table?: boolean;
  trellis_loops?: number;
  auto_subsample?: boolean;
  chroma_subsample?: number;
  separate_chroma_quality?: boolean;
  chroma_quality?: number;
}

export interface PngEncodeOptions {
  // @jsquash/png only supports bitDepth
  bitDepth?: 8;
}

export interface OxipngOptimizeOptions {
  level?: number; // 1–6
  interlace?: boolean;
  optimiseAlpha?: boolean;
}

export interface WebpEncodeOptions {
  quality: number; // 0–100
  lossless?: number; // 0 or 1
  method?: number; // 0–6 compression effort
  alpha_compression?: number;
  alpha_filtering?: number;
  alpha_quality?: number;
  pass?: number;
  preprocessing?: number;
  segments?: number;
  sns_strength?: number;
  filter_strength?: number;
  filter_sharpness?: number;
  filter_type?: number;
  autofilter?: number;
  partitions?: number;
  partition_limit?: number;
  emulate_jpeg_size?: number;
  thread_level?: number;
  low_memory?: number;
  near_lossless?: number;
  exact?: number;
  use_delta_palette?: number;
  use_sharp_yuv?: number;
}

export interface AvifEncodeOptions {
  cqLevel?: number; // 0–62, lower = better quality
  cqAlphaLevel?: number;
  denoiseLevel?: number;
  tileRowsLog2?: number;
  tileColsLog2?: number;
  speed?: number; // 0–10
  subsample?: number;
}

export type WasmEncodeOptions =
  | JpegEncodeOptions
  | PngEncodeOptions
  | WebpEncodeOptions
  | AvifEncodeOptions;

// ---------------------------------------------------------------------------
// Lazy codec module holders
// ---------------------------------------------------------------------------

type JpegModule = typeof import('@jsquash/jpeg');
type PngModule = typeof import('@jsquash/png');
type OxipngModule = typeof import('@jsquash/oxipng');
type WebpModule = typeof import('@jsquash/webp');
type AvifModule = typeof import('@jsquash/avif');

let jpegModule: JpegModule | null = null;
let pngModule: PngModule | null = null;
let oxipngModule: OxipngModule | null = null;
let webpModule: WebpModule | null = null;
let avifModule: AvifModule | null = null;

// ---------------------------------------------------------------------------
// Lazy codec loaders
// ---------------------------------------------------------------------------

async function loadJpeg(): Promise<JpegModule> {
  if (!jpegModule) {
    try {
      jpegModule = await import('@jsquash/jpeg');
    } catch {
      throw encoderUnavailable('jpeg');
    }
  }
  return jpegModule;
}

async function loadPng(): Promise<PngModule> {
  if (!pngModule) {
    try {
      pngModule = await import('@jsquash/png');
    } catch {
      throw encoderUnavailable('png');
    }
  }
  return pngModule;
}

async function loadOxipng(): Promise<OxipngModule> {
  if (!oxipngModule) {
    try {
      oxipngModule = await import('@jsquash/oxipng');
    } catch {
      throw encoderUnavailable('oxipng');
    }
  }
  return oxipngModule;
}

async function loadWebp(): Promise<WebpModule> {
  if (!webpModule) {
    try {
      webpModule = await import('@jsquash/webp');
    } catch {
      throw encoderUnavailable('webp');
    }
  }
  return webpModule;
}

async function loadAvif(): Promise<AvifModule> {
  if (!avifModule) {
    try {
      avifModule = await import('@jsquash/avif');
    } catch {
      throw encoderUnavailable('avif');
    }
  }
  return avifModule;
}

// ---------------------------------------------------------------------------
// Public decode API
// ---------------------------------------------------------------------------

/**
 * Decode raw image bytes into RGBA ImageData using the appropriate WASM codec.
 *
 * @throws {ImageCompressionError} DECODE_FAILED on decode error.
 * @throws {ImageCompressionError} ENCODER_UNAVAILABLE if the codec WASM cannot load.
 */
export async function wasmDecode(
  buffer: ArrayBuffer,
  format: ImageFormat,
): Promise<ImageData> {
  try {
    switch (format) {
      case 'jpeg': {
        const codec = await loadJpeg();
        return await codec.decode(buffer);
      }
      case 'png': {
        const codec = await loadPng();
        return await codec.decode(buffer);
      }
      case 'webp': {
        const codec = await loadWebp();
        return await codec.decode(buffer);
      }
      case 'avif': {
        const codec = await loadAvif();
        const result = await codec.decode(buffer);
        if (!result) throw new Error('AVIF decode returned null');
        return result;
      }
    }
  } catch (err) {
    if (
      err instanceof Error &&
      (err.name === 'ImageCompressionError' ||
        (err as { code?: string }).code === 'ENCODER_UNAVAILABLE')
    ) {
      throw err;
    }
    throw decodeFailed(format, err instanceof Error ? err.message : String(err));
  }
}

// ---------------------------------------------------------------------------
// Public encode API
// ---------------------------------------------------------------------------

/**
 * Encode RGBA ImageData into the given format using the appropriate WASM codec.
 *
 * @throws {ImageCompressionError} COMPRESSION_FAILED on encode error.
 * @throws {ImageCompressionError} ENCODER_UNAVAILABLE if the codec WASM cannot load.
 */
export async function wasmEncode(
  imageData: ImageData,
  format: ImageFormat,
  options: WasmEncodeOptions,
): Promise<ArrayBuffer> {
  try {
    switch (format) {
      case 'jpeg': {
        const codec = await loadJpeg();
        return await codec.encode(imageData, options as JpegEncodeOptions);
      }
      case 'png': {
        const codec = await loadPng();
        return await codec.encode(imageData, options as PngEncodeOptions);
      }
      case 'webp': {
        const codec = await loadWebp();
        return await codec.encode(imageData, options as WebpEncodeOptions);
      }
      case 'avif': {
        const codec = await loadAvif();
        return await codec.encode(imageData, options as AvifEncodeOptions);
      }
    }
  } catch (err) {
    if (
      err instanceof Error &&
      (err.name === 'ImageCompressionError' ||
        (err as { code?: string }).code === 'ENCODER_UNAVAILABLE')
    ) {
      throw err;
    }
    throw wrapUnknownError(err, 'COMPRESSION_FAILED');
  }
}

/**
 * Optimize a PNG ArrayBuffer using Oxipng (lossless PNG optimizer).
 *
 * @throws {ImageCompressionError} COMPRESSION_FAILED on optimizer error.
 */
export async function wasmOptimizePng(
  buffer: ArrayBuffer,
  options: OxipngOptimizeOptions = {},
): Promise<ArrayBuffer> {
  try {
    const codec = await loadOxipng();
    return await codec.optimise(buffer, options);
  } catch (err) {
    throw wrapUnknownError(err, 'COMPRESSION_FAILED');
  }
}

/** Returns true if the WASM environment appears to be available. */
export function isWasmAvailable(): boolean {
  return typeof WebAssembly !== 'undefined';
}
