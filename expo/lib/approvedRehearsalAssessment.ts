import type { ApprovedRehearsalConfig } from "@/lib/approvedRehearsals";

/** Proposed client boundary, NOT a deployed backend contract or semantic evaluator. */
export interface ApprovedAssessmentRequest {
  contractVersion: "approved-rehearsal-assessment-v1";
  runId: string;
  contentVersion: string;
  lessonId: string;
  scenarioId: string;
  counterpartId: string;
  scene: string;
  behaviorId: string;
  behavior: string;
  turns: readonly { id: string; role: "learner" | "counterpart"; approvedText: string }[];
  targetTurnId: string;
}
export interface ApprovedAssessmentEnvelope {
  binding: ApprovedAssessmentRequest;
  status: "met" | "not_met" | "insufficient_evidence";
  rationale: string;
  evidence: readonly { turnId: string; quote: string; start: number; end: number }[];
}

/**
 * Structural/evidence validation only: quote matching cannot prove semantic correctness.
 * The caller must supply a locally captured approved exchange and a trusted provider
 * response, then separately validate the evaluator's semantic quality before enabling UI.
 * No provider adapter, endpoint, score calibration, or production opt-in exists here.
 */
export function validateApprovedAssessmentEnvelope(config: ApprovedRehearsalConfig, request: ApprovedAssessmentRequest, raw: unknown): ApprovedAssessmentEnvelope | null {
  if (!request || request.contractVersion !== "approved-rehearsal-assessment-v1"
    || typeof request.runId !== "string" || !request.runId.trim()
    || request.contentVersion !== config.contentVersion || request.lessonId !== config.lessonId
    || request.scenarioId !== config.scenario.id || request.counterpartId !== config.counterpartId
    || request.scene !== config.scenario.situation || request.behaviorId !== config.coachedBehaviorId
    || request.behavior !== config.namedMove || !Array.isArray(request.turns)
    || request.turns.length !== 4) return null;
  const roles = ["learner", "counterpart", "learner", "counterpart"];
  if (request.turns.some((turn, i) => !turn || typeof turn.id !== "string" || !turn.id.trim()
    || turn.role !== roles[i] || typeof turn.approvedText !== "string" || !turn.approvedText.trim())
    || new Set(request.turns.map((turn) => turn.id)).size !== request.turns.length) return null;
  const target = request.turns.find((turn) => turn.id === request.targetTurnId && turn.role === "learner");
  if (!target || !raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const item = raw as Record<string, unknown>;
  if (Object.keys(item).sort().join(",") !== "binding,evidence,rationale,status"
    || !item.binding || typeof item.binding !== "object" || Array.isArray(item.binding)
    || typeof item.status !== "string" || !["met", "not_met", "insufficient_evidence"].includes(item.status)
    || typeof item.rationale !== "string" || !item.rationale.trim() || item.rationale.length > 2000
    || !Array.isArray(item.evidence)) return null;
  const binding = item.binding as Record<string, unknown>;
  if (Object.keys(binding).sort().join(",") !== Object.keys(request).sort().join(",")) return null;
  for (const key of Object.keys(request) as (keyof ApprovedAssessmentRequest)[]) {
    if (key === "turns") continue;
    if (binding[key] !== request[key]) return null;
  }
  if (!Array.isArray(binding.turns) || binding.turns.length !== request.turns.length
    || binding.turns.some((turn, i) => !turn || typeof turn !== "object"
      || Object.keys(turn).sort().join(",") !== "approvedText,id,role"
      || turn.id !== request.turns[i].id || turn.role !== request.turns[i].role
      || turn.approvedText !== request.turns[i].approvedText)) return null;
  if (item.status === "insufficient_evidence" ? item.evidence.length !== 0 : item.evidence.length === 0 || item.evidence.length > 3) return null;
  const seen = new Set<string>();
  for (const evidence of item.evidence) {
    if (!evidence || typeof evidence !== "object" || Object.keys(evidence).sort().join(",") !== "end,quote,start,turnId"
      || evidence.turnId !== target.id || typeof evidence.quote !== "string" || !evidence.quote.trim()
      || !Number.isSafeInteger(evidence.start) || !Number.isSafeInteger(evidence.end)
      || evidence.start < 0 || evidence.end <= evidence.start || evidence.end > target.approvedText.length
      || target.approvedText.slice(evidence.start, evidence.end) !== evidence.quote || seen.has(evidence.quote)) return null;
    seen.add(evidence.quote);
  }
  // Snapshot so subsequent mutation cannot change the envelope after validation.
  return JSON.parse(JSON.stringify(item)) as ApprovedAssessmentEnvelope;
}
