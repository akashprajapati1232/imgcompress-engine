/**
 * @fileoverview ICC profile utilities — V1 stub.
 *
 * Future: implement ICC profile parsing, embedding, and stripping.
 * This would typically use a library like icc or a custom parser
 * to handle Display P3, Adobe RGB, etc.
 */

/** Strips ICC profile from a raw image buffer. V1 stub — returns buffer unchanged. */
export function stripIccProfile(buffer: ArrayBuffer): ArrayBuffer {
  // TODO: parse JPEG/PNG/WebP headers and remove ICC chunks
  return buffer;
}

/** Extracts the ICC profile from a raw image buffer. V1 stub — returns null. */
export function extractIccProfile(_buffer: ArrayBuffer): ArrayBuffer | null {
  // TODO: parse JPEG APP2 marker / PNG iCCP chunk / WebP ICCP chunk
  return null;
}
