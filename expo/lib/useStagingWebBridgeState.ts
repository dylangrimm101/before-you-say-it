import { useSyncExternalStore } from "react";
import type { StagingWebBridge } from "./stagingWebBridge";
import type { PrivateWebBridgeState } from "./privateWebBridgeCoordinator";
const unavailable: PrivateWebBridgeState = { status: "unavailable", record: null };
const subscribe = () => () => {};
const snapshot = () => unavailable;
export function useStagingWebBridgeState(bridge: StagingWebBridge) {
  return useSyncExternalStore(bridge?.subscribe ?? subscribe, bridge?.getSnapshot ?? snapshot, bridge?.getSnapshot ?? snapshot);
}
