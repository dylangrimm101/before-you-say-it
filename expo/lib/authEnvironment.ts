export const STAGING_AUTH_URL = "https://pqqxaklcburdxjfeolmd.supabase.co";
export function selectAuthEnvironment(input: {
  developmentBuild: boolean; nativeStagingBuild: boolean; mode?: string;
  stagingUrl?: string; stagingKey?: string; productionUrl?: string; productionKey?: string; stagingAccountRelease?: boolean;
  applicationId?: string | null; projectId?: string | null;
}) {
  if (input.mode || input.nativeStagingBuild) {
    if ((!input.developmentBuild && !input.stagingAccountRelease) || !input.nativeStagingBuild || input.mode !== "staging-account"
      || input.stagingUrl !== STAGING_AUTH_URL || !/^sb_publishable_[A-Za-z0-9_-]+$/.test(input.stagingKey ?? "")) return null;
    return { staging: true, url: STAGING_AUTH_URL, key: input.stagingKey!, storageKey: "bysi.staging.pqqxaklcburdxjfeolmd.auth", keychainService: "beforeyousayit.staging.supabase", applicationId: input.applicationId ?? null, projectId: input.projectId ?? null };
  }
  const url = input.productionUrl?.trim() ?? "";
  const key = input.productionKey?.trim() ?? "";
  return url && key ? { staging: false, url, key, storageKey: undefined, keychainService: "beforeyousayit.supabase", applicationId: null, projectId: null } : null;
}
