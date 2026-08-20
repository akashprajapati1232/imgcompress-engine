/**
 * @fileoverview Test fixtures — synthetic image buffers for testing.
 *
 * Generates minimal valid image files using magic bytes and known
 * valid binary structures. These do not require actual codec libraries
 * to create — they are hand-crafted valid binary headers.
 */

// ---------------------------------------------------------------------------
// JPEG: minimal 1×1 JFIF JPEG
// ---------------------------------------------------------------------------

export const JPEG_1x1 = new Uint8Array([
  0xff, 0xd8, 0xff, 0xe0, // SOI + APP0 marker
  0x00, 0x10,             // APP0 length (16)
  0x4a, 0x46, 0x49, 0x46, 0x00, // "JFIF\0"
  0x01, 0x01,             // version 1.1
  0x00,                   // aspect ratio units
  0x00, 0x01,             // X density
  0x00, 0x01,             // Y density
  0x00, 0x00,             // thumbnail
  0xff, 0xdb, 0x00, 0x43, 0x00, // DQT marker
  // Quantization table (64 bytes of 1s)
  ...Array(64).fill(1),
  0xff, 0xc0, 0x00, 0x0b, // SOF0 marker
  0x08,                   // precision
  0x00, 0x01,             // height 1
  0x00, 0x01,             // width 1
  0x01,                   // components
  0x01, 0x11, 0x00,       // component descriptor
  0xff, 0xc4, 0x00, 0x1f, // DHT marker
  0x00,
  ...Array(16).fill(0),
  0x00,
  0xff, 0xda, 0x00, 0x08, // SOS marker
  0x01, 0x01, 0x00, 0x00, 0x3f, 0x00,
  0x7f,                   // compressed scan data
  0xff, 0xd9,             // EOI
]).buffer;

// ---------------------------------------------------------------------------
// PNG: minimal 1×1 PNG (red pixel)
// ---------------------------------------------------------------------------

export const PNG_1x1 = new Uint8Array([
  // PNG signature
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
  // IHDR chunk
  0x00, 0x00, 0x00, 0x0d, // length = 13
  0x49, 0x48, 0x44, 0x52, // "IHDR"
  0x00, 0x00, 0x00, 0x01, // width = 1
  0x00, 0x00, 0x00, 0x01, // height = 1
  0x08,                   // bit depth = 8
  0x02,                   // color type = RGB
  0x00, 0x00, 0x00,       // compression, filter, interlace
  0x90, 0x77, 0x53, 0xde, // CRC
  // IDAT chunk
  0x00, 0x00, 0x00, 0x0c, // length = 12
  0x49, 0x44, 0x41, 0x54, // "IDAT"
  0x08, 0xd7, 0x63, 0xf8, 0xcf, 0xc0, 0x00, 0x00,
  0x00, 0x02, 0x00, 0x01, // compressed data
  0xe2, 0x21, 0xbc, 0x33, // CRC
  // IEND chunk
  0x00, 0x00, 0x00, 0x00, // length = 0
  0x49, 0x45, 0x4e, 0x44, // "IEND"
  0xae, 0x42, 0x60, 0x82, // CRC
]).buffer;

// ---------------------------------------------------------------------------
// WebP: minimal 1×1 WebP (lossless)
// ---------------------------------------------------------------------------

export const WEBP_1x1 = new Uint8Array([
  // RIFF header
  0x52, 0x49, 0x46, 0x46, // "RIFF"
  0x1a, 0x00, 0x00, 0x00, // file size - 8
  0x57, 0x45, 0x42, 0x50, // "WEBP"
  // VP8L chunk
  0x56, 0x50, 0x38, 0x4c, // "VP8L"
  0x0e, 0x00, 0x00, 0x00, // chunk size
  0x2f,                   // signature
  0x00, 0x00, 0x00, 0x00, // width-1, height-1 (packed)
  0x00, 0x00, 0x00, 0x00,
  0x00, 0x00, 0x00, 0x00,
  0x00, 0x00,
]).buffer;

// ---------------------------------------------------------------------------
// AVIF: minimal AVIF (ftyp box with avif brand)
// ---------------------------------------------------------------------------

export const AVIF_1x1 = new Uint8Array([
  // ftyp box
  0x00, 0x00, 0x00, 0x18, // box size = 24
  0x66, 0x74, 0x79, 0x70, // "ftyp"
  0x61, 0x76, 0x69, 0x66, // major brand "avif"
  0x00, 0x00, 0x00, 0x00, // minor version
  0x61, 0x76, 0x69, 0x66, // compatible brand "avif"
  0x6d, 0x69, 0x66, 0x31, // compatible brand "mif1"
  // Minimal mdat (placeholder)
  0x00, 0x00, 0x00, 0x08, // box size = 8
  0x6d, 0x64, 0x61, 0x74, // "mdat"
]).buffer;

// ---------------------------------------------------------------------------
// Unsupported formats
// ---------------------------------------------------------------------------

export const GIF_HEADER = new Uint8Array([
  0x47, 0x49, 0x46, 0x38, 0x39, 0x61, // "GIF89a"
  0x01, 0x00, 0x01, 0x00, 0x00, 0x00, 0x00,
]).buffer;

export const BMP_HEADER = new Uint8Array([
  0x42, 0x4d, // "BM"
  0x3a, 0x00, 0x00, 0x00, // file size
  0x00, 0x00, 0x00, 0x00,
]).buffer;

// ---------------------------------------------------------------------------
// Helper: create a File from a buffer
// ---------------------------------------------------------------------------

export function bufferToFile(
  buffer: ArrayBuffer,
  name: string,
  type: string,
): File {
  return new File([buffer], name, { type });
}

export function bufferToBlob(buffer: ArrayBuffer, type: string): Blob {
  return new Blob([buffer], { type });
}

// ---------------------------------------------------------------------------
// Format fixture map
// ---------------------------------------------------------------------------

export const FORMAT_FIXTURES = {
  jpeg: { buffer: JPEG_1x1, name: 'test.jpg', type: 'image/jpeg' },
  png:  { buffer: PNG_1x1,  name: 'test.png', type: 'image/png'  },
  webp: { buffer: WEBP_1x1, name: 'test.webp',type: 'image/webp' },
  avif: { buffer: AVIF_1x1, name: 'test.avif',type: 'image/avif' },
} as const;

export function getFixtureFile(format: keyof typeof FORMAT_FIXTURES): File {
  const f = FORMAT_FIXTURES[format];
  return bufferToFile(f.buffer, f.name, f.type);
}
