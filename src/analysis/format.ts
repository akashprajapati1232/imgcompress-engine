/**
 * @fileoverview Magic-byte based image format detection.
 *
 * We never trust the file extension or MIME type field alone.
 * Instead we read the first bytes of the file and compare against
 * known binary signatures (magic bytes).
 */

import type { ImageFormat, ImageMimeType } from '../types/index.js';
import { unsupportedFormat, invalidImage } from '../errors/ImageCompressionError.js';

// ---------------------------------------------------------------------------
// Signature definitions
// ---------------------------------------------------------------------------

/** A magic byte pattern and its required byte offset. */
interface Signature {
  bytes: Uint8Array;
  offset: number;
}

const JPEG_SIG: Signature = {
  bytes: new Uint8Array([0xff, 0xd8, 0xff]),
  offset: 0,
};

const PNG_SIG: Signature = {
  bytes: new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  offset: 0,
};

// RIFF....WEBP — bytes 0-3 are "RIFF", bytes 8-11 are "WEBP"
const WEBP_RIFF: Signature = {
  bytes: new Uint8Array([0x52, 0x49, 0x46, 0x46]),
  offset: 0,
};
const WEBP_MARKER: Signature = {
  bytes: new Uint8Array([0x57, 0x45, 0x42, 0x50]),
  offset: 8,
};

// AVIF / HEIF: ISO Base Media File Format with "ftyp" box.
// Byte offsets 4–7 == "ftyp"; brand at offsets 8–11.
const FTYP_MARKER: Signature = {
  bytes: new Uint8Array([0x66, 0x74, 0x79, 0x70]), // "ftyp"
  offset: 4,
};

// Known AVIF brands
const AVIF_BRANDS = new Set([
  'avif', 'avis', 'avic', 'avcs',
  'MA1A', 'MA1B', // AV1 still / sequence
]);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function matchSignature(header: Uint8Array, sig: Signature): boolean {
  if (header.length < sig.offset + sig.bytes.length) return false;
  for (let i = 0; i < sig.bytes.length; i++) {
    if (header[sig.offset + i] !== sig.bytes[i]) return false;
  }
  return true;
}

function readBrand(header: Uint8Array, offset: number): string {
  let brand = '';
  for (let i = 0; i < 4; i++) {
    brand += String.fromCharCode(header[offset + i] ?? 0);
  }
  return brand;
}

function isAvifBrand(header: Uint8Array): boolean {
  // Major brand at offset 8
  const major = readBrand(header, 8);
  if (AVIF_BRANDS.has(major)) return true;

  // Compatible brands start at offset 16, each 4 bytes
  for (let offset = 16; offset + 4 <= Math.min(header.length, 64); offset += 4) {
    if (AVIF_BRANDS.has(readBrand(header, offset))) return true;
  }
  return false;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** Result of format detection. */
export interface DetectedFormat {
  format: ImageFormat;
  mimeType: ImageMimeType;
}

/**
 * Detect the image format from the raw bytes of the file.
 * Reads only the first 64 bytes — no need to load the full image.
 *
 * @throws {ImageCompressionError} INVALID_IMAGE — if the buffer is too small or unreadable.
 * @throws {ImageCompressionError} UNSUPPORTED_FORMAT — if the format is not supported.
 */
export async function detectFormat(file: File | Blob): Promise<DetectedFormat> {
  const headerSize = 64;
  const slice = file.slice(0, headerSize);

  let buffer: ArrayBuffer;
  try {
    buffer = await slice.arrayBuffer();
  } catch (err) {
    throw invalidImage('Could not read file header bytes.');
  }

  const header = new Uint8Array(buffer);

  if (header.length < 4) {
    throw invalidImage('File is too small to be a valid image.');
  }

  // JPEG
  if (matchSignature(header, JPEG_SIG)) {
    return { format: 'jpeg', mimeType: 'image/jpeg' };
  }

  // PNG
  if (matchSignature(header, PNG_SIG)) {
    return { format: 'png', mimeType: 'image/png' };
  }

  // WebP (RIFF container with WEBP marker)
  if (
    matchSignature(header, WEBP_RIFF) &&
    matchSignature(header, WEBP_MARKER)
  ) {
    return { format: 'webp', mimeType: 'image/webp' };
  }

  // AVIF (ISO BMFF ftyp box)
  if (matchSignature(header, FTYP_MARKER) && isAvifBrand(header)) {
    return { format: 'avif', mimeType: 'image/avif' };
  }

  // Try to get a hint from the MIME type for a better error message
  const hint = file instanceof File ? file.type : 'unknown';
  throw unsupportedFormat(hint || 'unknown');
}

/** Maps a format string to its canonical MIME type. */
export function formatToMime(format: ImageFormat): ImageMimeType {
  const map: Record<ImageFormat, ImageMimeType> = {
    jpeg: 'image/jpeg',
    png: 'image/png',
    webp: 'image/webp',
    avif: 'image/avif',
  };
  return map[format];
}

/** Maps a MIME type to its canonical format string. */
export function mimeToFormat(mime: string): ImageFormat | null {
  const map: Record<string, ImageFormat> = {
    'image/jpeg': 'jpeg',
    'image/jpg': 'jpeg',
    'image/png': 'png',
    'image/webp': 'webp',
    'image/avif': 'avif',
  };
  return map[mime] ?? null;
}
