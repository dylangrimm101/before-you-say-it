const BASE64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

/** Hermes-safe encoding: no Buffer, Blob(ArrayBuffer), or large spread calls. */
export function speechBytesToBase64(bytes: Uint8Array): string {
  if (!bytes.length) throw new Error('Voice response was empty');
  if (bytes.length > 2 * 1024 * 1024) throw new Error('Voice response was too large');
  const chunks: string[] = [];
  let chunk = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i], b = bytes[i + 1] ?? 0, c = bytes[i + 2] ?? 0;
    chunk += BASE64[a >> 2] + BASE64[((a & 3) << 4) | (b >> 4)]
      + (i + 1 < bytes.length ? BASE64[((b & 15) << 2) | (c >> 6)] : '=')
      + (i + 2 < bytes.length ? BASE64[c & 63] : '=');
    if (chunk.length >= 16384) { chunks.push(chunk); chunk = ''; }
  }
  chunks.push(chunk);
  return chunks.join('');
}
