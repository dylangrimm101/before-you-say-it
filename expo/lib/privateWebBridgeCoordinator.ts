import { createPrivateWebBridgeClient, type PrivateWebBridgeConfig, type RestoredWebRecord } from "./privateWebBridge";

type LifecycleSession = { user: { id: string; is_anonymous?: boolean; email_confirmed_at?: string } } | null;
export type LifecycleBridgeAuth = PrivateWebBridgeConfig["auth"] & {
  onAuthStateChange(callback: (event: string, session: LifecycleSession) => void): { data: { subscription: { unsubscribe(): void } } };
};
/** Opt-in test/dev seam: pass the SAME project-pinned supabase.auth as AuthProvider.
 * No auth network calls inside the synchronous auth listener (Supabase lock safety).
 */
export function createAuthBoundPrivateWebBridge(config: PrivateWebBridgeConfig & { auth: LifecycleBridgeAuth }) {
  const coordinator = createPrivateWebBridgeCoordinator(createPrivateWebBridgeClient(config));
  let revision = 0, disposed = false;
  const apply = (session: LifecycleSession) => {
    if (!disposed) coordinator.setAccount(session?.user.is_anonymous === false && session.user.email_confirmed_at ? session.user.id : null);
  };
  const initialRevision = revision;
  const { data: listener } = config.auth.onAuthStateChange((_event, session) => { ++revision; apply(session); });
  void config.auth.getSession().then(({ data, error }) => {
    if (revision === initialRevision) apply(error ? null : data.session);
  }).catch(() => { if (revision === initialRevision) apply(null); });
  return {
    getSnapshot: coordinator.getSnapshot, subscribe: coordinator.subscribe,
    activate: coordinator.activate, restore: coordinator.restore, discover: coordinator.discover, discoveryEnabled: !!config.endpoints.discover, clear: coordinator.clear,
    dispose() { disposed = true; ++revision; listener.subscription.unsubscribe(); coordinator.dispose(); },
  };
}
export type PrivateWebBridgeState = { status: "idle" | "loading" | "unavailable" | "empty"; record: null } | { status: "ready"; record: RestoredWebRecord };
/** Staged external store for useSyncExternalStore. No persistence, navigation or entitlement writes. */
export function createPrivateWebBridgeCoordinator(client: Pick<ReturnType<typeof createPrivateWebBridgeClient>, "activate" | "restore"> & Partial<Pick<ReturnType<typeof createPrivateWebBridgeClient>, "discover" | "discoveryEnabled">>) {
  let account: string | null = null;
  let state: PrivateWebBridgeState = { status: "idle", record: null };
  let generation = 0;
  let disposed = false;
  let pending: AbortController | null = null;
  const listeners = new Set<() => void>();
  const publish = (next: PrivateWebBridgeState) => { state = next; listeners.forEach(listener => listener()); };
  const invalidate = () => { ++generation; pending?.abort(); pending = null; };
  const clear = () => { invalidate(); publish({ status: "idle", record: null }); };
  async function run(operation: "activate" | "restore" | "discover", value: string): Promise<boolean> {
    if (disposed || !account) return false;
    invalidate();
    const revision = generation, owner = account;
    const control = new AbortController(); pending = control;
    const current = () => !disposed && generation === revision && account === owner && !control.signal.aborted;
    let cancel = () => {};
    const canceled = new Promise<never>((_, reject) => {
      cancel = () => reject(new Error("Canceled"));
      control.signal.addEventListener("abort", cancel, { once: true });
    });
    publish({ status: "loading", record: null });
    try {
      let sessionId = value;
      if (!current()) return false;
      if (operation === "discover") {
        if (!client.discoveryEnabled || !client.discover) throw new Error("Discovery unavailable");
        const found = await Promise.race([client.discover(owner, control.signal), canceled]);
        if (!current()) return false;
        if (!found) { publish({ status: "empty", record: null }); return true; }
        sessionId = found.sessionId;
      }
      if (operation === "activate") {
        const activated = await Promise.race([client.activate(value, owner, control.signal), canceled]);
        if (!current()) return false;
        sessionId = activated.sessionId;
      }
      const record = await Promise.race([client.restore(sessionId, owner, control.signal), canceled]);
      if (!current()) return false;
      publish({ status: "ready", record });
      return true;
    } catch {
      if (current()) publish({ status: "unavailable", record: null });
      return false;
    } finally {
      control.signal.removeEventListener("abort", cancel);
      if (pending === control) pending = null;
    }
  }
  return {
    setAccount(next: string | null) {
      if (!disposed && next !== account) {
        account = next; clear();
        const scheduled = generation;
        // Defer beyond synchronous Supabase auth callback/lock. Guard A→B→logout.
        if (next && client.discoveryEnabled) setTimeout(() => {
          if (!disposed && generation === scheduled && account === next) void run("discover", "");
        }, 0);
      }
    },
    getSnapshot: () => state,
    subscribe(listener: () => void) { if (!disposed) listeners.add(listener); return () => { listeners.delete(listener); }; },
    discover: () => run("discover", ""),
    activate: (token: string) => run("activate", token),
    restore: (sessionId: string) => run("restore", sessionId),
    clear,
    dispose() { disposed = true; account = null; clear(); listeners.clear(); },
  };
}
