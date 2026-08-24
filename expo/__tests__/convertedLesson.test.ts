import { describe, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import path from "node:path";

import { convertedHandoffDeckHtml, returnedDeckHtml } from "@/lib/approvedDeckLoader";
import { M1_L1_CONVERSION, m1L1CoachNote, m1L1Comparison } from "@/lib/convertedLesson";
import {
  attachScenarioCoaching,
  attachScenarioCounterpartTurn,
  completeScenarioComparison,
  createScenarioPracticeRun,
  preserveScenarioAttempt,
} from "@/lib/scenarioPractice";

const ROOT = path.resolve(import.meta.dir, "..");

function source(relativePath: string): Promise<string> {
  return readFile(path.join(ROOT, relativePath), "utf8");
}

function fixtureDeck(): string {
  const template = `const CARDS = [
  { n:20, type:'Rehearsal handoff' },
  { n:21, type:'Saved move' },
  { n:22, type:'Transfer cue' }
];
class Component {
  state = { i:0, picks:{} };
  view() { return { openHandoff:() => { this.setState({ handoffOpen:true }); }, handoffContinue:() => {} }; }
}`;
  return `<html><script type="__bundler/template">${JSON.stringify(template)}</script></html>`;
}

describe("M1 L1 conversion vertical slice", () => {
  test("binds stable manifest identity and deck-relative return cards", () => {
    expect(M1_L1_CONVERSION.practiceId).toBe("gtp_conversation_job");
    expect(M1_L1_CONVERSION.contentVersion).toBe("m1-l1-v2.1-2026-08-24");
    expect(M1_L1_CONVERSION.rehearsalHandoffCard).toBe(20);
    expect(M1_L1_CONVERSION.returnCard).toBe(21);
    expect(M1_L1_CONVERSION.completionCard).toBe(22);
    expect(M1_L1_CONVERSION.launchEligible).toBe(false);
  });

  test("converts the handoff without packaging post-rehearsal cards early", () => {
    const html = convertedHandoffDeckHtml(fixtureDeck(), 20);
    expect(html).toContain("start-rehearsal");
    expect(html).not.toContain("{ n:21, type:");
    expect(html).not.toContain("{ n:22, type:");
  });

  test("returns to the exact manifest card after a real rehearsal", () => {
    const html = returnedDeckHtml(fixtureDeck(), M1_L1_CONVERSION.returnCard);
    expect(html).toContain("state = { i:20,");
    expect(html).toContain("{ n:21, type:'Saved move' }");
    expect(html).toContain("{ n:22, type:'Transfer cue' }");
  });

  test("persists and reuses the exact authored pressure turn for retry", () => {
    let value = createScenarioPracticeRun(M1_L1_CONVERSION.scenario, "steady", "defensive", "run-1", 1);
    value = { ...value, run: { ...value.run, practiceId: M1_L1_CONVERSION.practiceId, contentVersion: M1_L1_CONVERSION.contentVersion } };
    value = preserveScenarioAttempt(value, "opener", "I want to change how we split bedtime.", 2);
    value = attachScenarioCounterpartTurn(value, { id: "pressure-1", text: M1_L1_CONVERSION.authoredPressureText, source: "authored" }, 3);
    value = preserveScenarioAttempt(value, "response", "The last three nights I did bedtime alone.", 4);
    value = attachScenarioCoaching(value, "One observable note.", M1_L1_CONVERSION.retryDirection, "conversation_job", 5);
    value = preserveScenarioAttempt(value, "retry", "Bedtime is the point. I did the last three nights. Can you take Tuesday and Thursday?", 6);
    value = completeScenarioComparison(value, 7);

    expect(value.run.counterpartTurn?.text).toBe("You're acting like this happens all the time.");
    expect(value.run.adamReactionId).toBe("pressure-1");
    expect(value.run.retryAttempt?.transcript).toContain("Bedtime is the point");
    expect(JSON.stringify(value)).not.toMatch(/"scores?"|communicationIndex|xp|streak/i);
  });

  test("keeps Hope feedback transcript-grounded, single-behavior, and bounded", () => {
    const transcript = "I want to keep this on bedtime. I handled the last three nights. Can you take Tuesday and Thursday?";
    const note = m1L1CoachNote(transcript);
    expect(note).not.toBeNull();
    expect(transcript).toContain(note?.evidenceQuote ?? "missing");
    expect(note?.coachedBehaviorId).toBe("conversation_job");
    expect(`${note?.worked} ${note?.change}`.trim().split(/\s+/).length).toBeLessThanOrEqual(32);
    expect(note?.retryDirection.trim().split(/\s+/).length).toBeLessThanOrEqual(20);
    expect(`${note?.worked} ${note?.change} ${note?.retryDirection}`.trim().split(/\s+/).length).toBeLessThanOrEqual(48);
  });

  test("compares only concrete opening wording without producing a score", () => {
    const comparison = m1L1Comparison(
      "I know this is complicated, but I wanted to discuss bedtime and a lot of other things.",
      "I want to change how we split bedtime. Can you take Tuesday and Thursday?",
    );
    expect(comparison.split(/\s+/).length).toBeLessThanOrEqual(36);
    expect(comparison).toContain("First attempt began");
    expect(comparison).toContain("Retry began");
    expect(comparison).not.toMatch(/score|percent|grade|improved/i);
  });

  test("keeps safety answers ephemeral and completion separate from legacy scores", async () => {
    const route = await source("app/approved-rehearsal/[lessonId].tsx");
    const store = await source("providers/store.tsx");
    const deck = await source("app/approved-lesson/[lessonId].tsx");
    expect(route).toContain("I'm not sure.");
    expect(route).toContain("A DIFFERENT ROUTE MAY FIT BETTER");
    expect(route).not.toContain("safetyAnswer");
    expect(store).toContain('convertedLessonProgress: "cc.convertedLessonProgress.v1"');
    expect(store).toContain("commitConvertedLessonProgress");
    expect(deck).toContain("saveActiveScenarioRun(null)");
    expect(deck).not.toContain("saveScoredPracticeRecord");
  });

  test("implements explicit transcript approval, typed fallback, TTS, and cleanup", async () => {
    const practice = await source("components/ScenarioPaidPractice.tsx");
    expect(practice).toContain("Use your voice for this rehearsal");
    expect(practice).toContain("Type this turn instead");
    expect(practice).toContain("Approve this transcript");
    expect(practice).toContain("await speak(pressureText, \"man-adam\")");
    expect(practice).toContain("await speak(pressure.text, \"man-adam\")");
    expect(practice).toContain("resetSpeech().catch");
    expect(practice).toContain("This doesn’t feel safe to practice");
  });
});
