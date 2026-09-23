/** Decode bounded JSON response bytes without depending on native TextDecoder.
 * The locked fetch polyfill treats ArrayBuffer text as one character per byte.
 * Invalid UTF-8 is rejected, never normalized into different authorized text.
 */
export function nativeResponseText(bytes: ArrayBuffer): string {
  const escaped = Array.from(new Uint8Array(bytes), byte => `%${byte.toString(16).padStart(2, '0')}`).join('');
  try {
    return decodeURIComponent(escaped);
  } catch {
    throw new Error('Invalid UTF-8 service response');
  }
}
