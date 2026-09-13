import { isVerifiedStagingWebBuyer, type PrivateWebBridgeConfig } from "./privateWebBridge";
import { createAuthBoundPrivateWebBridge, type LifecycleBridgeAuth } from "./privateWebBridgeCoordinator";

export type ReviewedStagingBridge = Pick<PrivateWebBridgeConfig, "environment" | "endpoints"> & { authUrl: string };
// Reviewed account-only deployment. AuthProvider additionally requires explicit isolated build opt-in.
export const REVIEWED_STAGING_BRIDGE: ReviewedStagingBridge | null = {
  environment: "staging",
  authUrl: "https://pqqxaklcburdxjfeolmd.supabase.co",
  endpoints: {
    // Reviewed hosted version 5 and real owner/JWT/RLS readback: OWNER-DISCOVERY-HOSTED.md.
    discover: "https://pqqxaklcburdxjfeolmd.supabase.co/functions/v1/bysi-staging-account/discover",
    activate: "https://pqqxaklcburdxjfeolmd.supabase.co/functions/v1/bysi-staging-account/activate",
    restore: "https://pqqxaklcburdxjfeolmd.supabase.co/functions/v1/bysi-staging-account/restore",
  },
};

export function createStagingWebBridge(input: {
  developmentBuild: boolean; reviewed: ReviewedStagingBridge | null;
  auth: LifecycleBridgeAuth | null; authUrl?: string;
  fetch?: PrivateWebBridgeConfig["fetch"];
}) {
  if (!input.developmentBuild || !input.reviewed || !input.auth || input.authUrl !== input.reviewed.authUrl) return null;
  try {
    const url = new URL(input.reviewed.authUrl);
    if (input.reviewed.environment === "staging") {
      if (input.reviewed.authUrl !== "https://pqqxaklcburdxjfeolmd.supabase.co") return null;
    } else if (!["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) || !["http:", "https:"].includes(url.protocol) || url.username || url.password || url.search || url.hash) return null;
  } catch { return null; }
  let owner: string | null = null;
  // Ephemeral purchase-presentation memory only; never authorizes a paid request.
  // Clearing private result content must not invite the same buyer to pay twice.
  let knownBuyerOwner: string | null = null;
  const actualAuth = input.auth;
  const apply = (session: { user: { id: string; is_anonymous?: boolean; email_confirmed_at?: string } } | null) => {
    const next = session?.user.is_anonymous === false && session.user.email_confirmed_at ? session.user.id : null;
    if (next !== owner) knownBuyerOwner = null;
    owner = next;
  };
  // The same auth client as AuthProvider; coordinator protects initial-session races.
  let revision = 0;
  const auth: LifecycleBridgeAuth = {
    getSession: async () => {
      const before = revision;
      const result = await actualAuth.getSession();
      if (before === revision) apply(result.error ? null : result.data.session);
      return result;
    },
    getUser: jwt => actualAuth.getUser(jwt),
    onAuthStateChange: callback => actualAuth.onAuthStateChange((event, session) => { ++revision; apply(session); callback(event, session); }),
  };
  try {
    const bridge = createAuthBoundPrivateWebBridge({ ...input.reviewed, auth, fetch: input.fetch ?? fetch });
    const stopRemembering = bridge.subscribe(() => {
      if (isVerifiedStagingWebBuyer(bridge.getSnapshot().record, owner, true)) knownBuyerOwner = owner;
    });
    return {
      ...bridge,
      suppressPurchasePrompt: () => isVerifiedStagingWebBuyer(bridge.getSnapshot().record, owner, true),
      hasKnownWebPurchase: () => owner !== null && knownBuyerOwner === owner,
      dispose: () => { stopRemembering(); knownBuyerOwner = null; bridge.dispose(); },
    };
  } catch { return null; }
}
export type StagingWebBridge = ReturnType<typeof createStagingWebBridge>;
/** Purchase UI only. Unverified web state never becomes paid access. */
export function stagingPurchasePresentation(state: import("./privateWebBridgeCoordinator").PrivateWebBridgeState, verified: boolean) {
  if (verified) return "verified-web";
  if (state.status !== "idle") return "verify-web";
  return "apple";
}
