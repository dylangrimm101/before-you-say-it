import { expect, test } from "bun:test";
import { approvedRehearsalConfig } from "@/lib/approvedRehearsals";

test("future semantic boundary binds identity, scene, behavior and exact approved exchange; rejects unsupported claims", async () => {
  const api = await import("@/lib/approvedRehearsalAssessment").catch(() => ({}));
  expect(typeof api.validateApprovedAssessmentEnvelope).toBe("function");
  const config = approvedRehearsalConfig("m1-l4")!;
  // Contract fixture only: this is not a live or semantically validated AI output.
  const request = { contractVersion: "approved-rehearsal-assessment-v1", runId: "run-1", contentVersion: config.contentVersion,
    lessonId: config.lessonId, scenarioId: config.scenario.id, counterpartId: config.counterpartId,
    scene: config.scenario.situation, behaviorId: config.coachedBehaviorId, behavior: config.namedMove,
    turns: [{ id: "open", role: "learner", approvedText: "The plan changed twice after I rearranged work." },
      { id: "pressure", role: "counterpart", approvedText: "So you're saying I don't think about your schedule." },
      { id: "response", role: "learner", approvedText: "I’m not saying you never think about my schedule. I’m talking about the two times this month the plan changed after I had rearranged work." },
      { id: "pressure-two", role: "counterpart", approvedText: "Why does that require a different plan?" }], targetTurnId: "response" };
  const response = { binding: request, status: "met", rationale: "The response limits the claim to two plan changes.", evidence: [{ turnId: "response", quote: request.turns[2].approvedText, start: 0, end: request.turns[2].approvedText.length }] };
  expect(api.validateApprovedAssessmentEnvelope(config, request, response)?.status).toBe("met");
  for (const field of ["runId", "contentVersion", "lessonId", "scenarioId", "counterpartId", "scene", "behaviorId", "behavior", "targetTurnId"]) {
    expect(api.validateApprovedAssessmentEnvelope(config, request, { ...response, binding: { ...request, [field]: "other" } })).toBeNull();
  }
  for (const malformed of [null, {}, { ...response, score: 72 }, { ...response, status: "success" }, { ...response, status: ["met"] }, { ...response, evidence: [] }, { ...response, rationale: "" },
    { ...response, evidence: [{ ...response.evidence[0], quote: "invented" }] },
    { ...response, evidence: [{ ...response.evidence[0], turnId: "pressure" }] },
    { ...response, evidence: [{ ...response.evidence[0], start: 1 }] },
    { ...response, evidence: [...response.evidence, ...response.evidence] },
    { ...response, binding: { ...request, turns: request.turns.map((t, i) => i === 2 ? { ...t, approvedText: "Changed after request" } : t) } }]) {
    expect(api.validateApprovedAssessmentEnvelope(config, request, malformed)).toBeNull();
  }
  expect(api.validateApprovedAssessmentEnvelope(config, request, { ...response, status: "insufficient_evidence", evidence: [] })?.status).toBe("insufficient_evidence");
  expect(api.validateApprovedAssessmentEnvelope(config, { ...request, scene: "Unapproved replacement" }, { ...response, binding: { ...request, scene: "Unapproved replacement" } })).toBeNull();
});
