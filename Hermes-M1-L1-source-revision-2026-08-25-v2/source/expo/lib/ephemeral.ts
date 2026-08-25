import type { Debrief, Turn } from "@/types/convo";

/**
 * In-memory holding area for the content of the rehearsal the user is in right
 * now. It exists so the live debrief can show quotes and a script immediately
 * after a rep, without any of that text being written to disk.
 *
 * Nothing here survives a reload of the app. There is deliberately no
 * serializer, no storage key, and no eviction to disk.
 */
export interface LiveSessionContent {
  turns: Turn[];
  debrief: Debrief;
  /** Outcome text the user named for this rep, if any. */
  outcome?: string;
}

/** Only the most recent rep is held; anything older is dropped immediately. */
let current: { id: string; content: LiveSessionContent } | null = null;

export function setLiveSessionContent(id: string, content: LiveSessionContent): void {
  current = { id, content };
}

export function getLiveSessionContent(id: string): LiveSessionContent | null {
  return current !== null && current.id === id ? current.content : null;
}

export function clearLiveSessionContent(id?: string): void {
  if (id === undefined || (current !== null && current.id === id)) current = null;
}
