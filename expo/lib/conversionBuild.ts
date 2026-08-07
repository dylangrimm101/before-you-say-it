import type { Debrief, Turn } from "@/types/convo";

export type ConversionEvent =
  | "transcript.confirmed"
  | "exchange.paired"
  | "skill.identified"
  | "path.mapped"
  | "plan.ready";

export interface ConversionBuild {
  id: string;
  scenarioTitle: string;
  counterpartName: string;
  turns: Turn[];
  events: ConversionEvent[];
  debrief: Debrief | null;
  error: string | null;
}

const CONVERSION_EVENT_ORDER: readonly ConversionEvent[] = [
  "transcript.confirmed",
  "exchange.paired",
  "skill.identified",
  "path.mapped",
  "plan.ready",
];

type Listener = () => void;
let current: ConversionBuild | null = null;
const listeners = new Set<Listener>();

function publish(next: ConversionBuild): void {
  current = next;
  listeners.forEach((listener) => listener());
}

/** Opens a memory-only build with no completed stages on its first frame. */
export function beginConversionBuild(input: Omit<ConversionBuild, "events" | "debrief" | "error">): void {
  publish({ ...input, events: [], debrief: null, error: null });
}

/** Records the next real pipeline boundary once and rejects out-of-order events. */
export function emitConversionEvent(id: string, event: ConversionEvent, debrief?: Debrief): void {
  if (current?.id !== id) return;
  const expected = CONVERSION_EVENT_ORDER[current.events.length];
  if (event !== expected) return;
  publish({
    ...current,
    events: [...current.events, event],
    debrief: debrief ?? current.debrief,
  });
}

export function failConversionBuild(id: string): void {
  if (current?.id !== id) return;
  publish({ ...current, error: "We couldn't finish your starting point. Your rehearsal is still safe." });
}

export function getConversionBuild(id: string): ConversionBuild | null {
  return current?.id === id ? current : null;
}

export function subscribeConversionBuild(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
