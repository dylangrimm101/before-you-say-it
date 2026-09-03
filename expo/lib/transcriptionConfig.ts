/** Resolves only the project's HTTPS Supabase transcription function URL. */
export function validatedTranscribeEndpoint(configuredEndpoint: string, supabaseUrl: string): string {
  try {
    const project = new URL(supabaseUrl.trim());
    if (project.protocol !== "https:" || project.username || project.password || project.search || project.hash) return "";
    const expected = new URL("/functions/v1/transcribe", project);
    const candidate = configuredEndpoint.trim() ? new URL(configuredEndpoint.trim()) : expected;
    if (candidate.protocol !== "https:" || candidate.username || candidate.password || candidate.search || candidate.hash) return "";
    if (candidate.origin !== expected.origin || candidate.pathname !== expected.pathname) return "";
    return candidate.toString();
  } catch {
    return "";
  }
}
