/** Parses one persisted JSON value without allowing corruption to abort sibling hydration. */
export function hydrateJsonEntry<T>(
  raw: string | null,
  fallback: T,
  key: string,
  onFailure?: (key: string, error: unknown) => void,
  normalize?: (value: unknown) => T | null,
): T {
  if (raw === null) return fallback;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!normalize) return parsed as T;
    return normalize(parsed) ?? fallback;
  } catch (error) {
    onFailure?.(key, error);
    return fallback;
  }
}
