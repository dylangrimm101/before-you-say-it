import { chromium } from "/tmp/bysi-playwright-v2/node_modules/playwright/index.mjs";

const BASE_URL = "http://127.0.0.1:4174";
const OUTPUT = "/home/user/rork-app/visual-verification/native-free-journey-v2";
const VIEWPORT = { width: 393, height: 852 };
const group = process.argv[2] ?? "all";

const profile = {
  focus: "work",
  pattern: "avoid",
  win: "heard",
  persona: "woman-hope",
  reaction: "defensive",
  createdAt: 100,
};
const turns = [
  { id: "opening", role: "user", text: "Can we decide which priority moves before more work is added?" },
  { id: "pushback", role: "them", text: "The deadline is fixed. Everyone is stretched right now." },
  { id: "response", role: "user", text: "I hear that. We have changed direction three times already. Which current priority should move?" },
];
const baseSession = {
  schemaVersion: 6,
  id: "practice-visual-v2",
  anonymousUserId: "anon-visual-v2",
  scenarioId: "visual-free-journey",
  category: "work",
  counterpart: "My manager",
  topic: "Project scope keeps changing after priorities are agreed.",
  usefulOutcome: "Leave with one answerable decision and a clear next step.",
  expectedReaction: "defensive",
  safetyStatus: "cleared",
  moduleVersion: "BYSI-days-1-8-v3-2026-08-04",
  entryRoute: "real_conversation",
  provisionalModuleId: "stay_clear_under_pushback",
  selectionLabel: "A conversation I need to prepare for",
  scenarioSource: "user_supplied",
  scenarioTitle: "Your conversation",
  counterpartRelationship: "manager",
  counterpartDisplayLabel: "My manager",
  behavioralGoal: "Keep one answerable request available after pushback.",
  persona: "woman-hope",
  pilotRuns: {},
  nextState: "awaiting_onboarding_baseline",
  createdAt: 100,
  updatedAt: 200,
};
const recommendation = {
  moduleId: "stay_clear_under_pushback",
  hypothesisModuleId: "stay_clear_under_pushback",
  evidenceQuote: "Which current priority should move?",
  evidenceTurnId: "response",
  confidence: "confirmed_quote",
  status: "suggested",
  supportedStrength: "You returned to one answerable decision.",
  immediateAction: "Acknowledge the concern, then return to one answerable decision.",
  createdAt: 200,
};
const pressureMoment = {
  pressure_moment_version: "pressure-moment-v1",
  headline: "Your request stayed visible after the pushback.",
  opening_turn_id: "opening",
  pushback_turn_id: "pushback",
  pressure_response_turn_id: "response",
  observation: "You acknowledged the concern, then added history before returning to the decision.",
  why_it_matters: "The extra history can make the answerable decision harder to find.",
  confidence_statement: "This is one short exchange. It suggests a starting point, not a fixed trait.",
};
const practiceShift = {
  practice_shift_version: "practice-shift-v1",
  headline: "Stay specific after pushback.",
  current_pattern_steps: ["Clear request", "They push back", "You acknowledge, then add history", "The decision disappears"],
  practice_target_steps: ["Clear request", "They push back", "Acknowledge the concern", "Return to one answerable decision"],
  success_target: "Leave with one answerable decision and a clear next step.",
  first_focus_key: "visual-fixture-specific-after-pushback",
  first_focus_label: "Stay specific after pushback.",
  recommended_module_id: "stay_clear_under_pushback",
  caveat: "A practice target, not a result you’ve already achieved.",
};
const signal = (signal_key, observation_status, score, evidence_turn_ids) => ({
  signal_key,
  observation_status,
  score,
  evidence_turn_ids,
  signal_version: "signal-v1",
});
const successfulSignals = [
  signal("clarity", "observed", 72, ["opening"]),
  signal("specificity", "observed", 66, ["opening", "response"]),
  signal("steadiness", "observed", 54, ["response"]),
  signal("listening", "unobserved", null, []),
  signal("boundaries", "unobserved", null, []),
  signal("repair", "unobserved", null, []),
];
const insufficientSignals = ["clarity", "specificity", "steadiness", "listening", "boundaries", "repair"]
  .map((key) => signal(key, "insufficient_evidence", null, []));
const firstFocus = {
  first_focus_key: "visual-fixture-specific-after-pushback",
  first_focus_label: "Stay specific after pushback.",
  recommended_module_id: "stay_clear_under_pushback",
  focus_status: "suggested",
  focus_version: "first-focus-v1",
};
const result = (successful) => ({
  contract_version: 1,
  rehearsal_id: baseSession.id,
  pressure_moment: pressureMoment,
  practice_shift: practiceShift,
  signals: successful ? successfulSignals : insufficientSignals,
  starting_index: {
    index_kind: "partial",
    index_value: successful ? 64 : null,
    observed_count: successful ? 3 : 0,
    total_signal_count: 6,
    index_version: "starting-index-v1",
  },
  first_focus: firstFocus,
});
const completedSession = (checkpoint, successful = true) => ({
  ...baseSession,
  freeRehearsalTurns: turns,
  freeRehearsalCompletedAt: 200,
  freeJourneyCheckpoint: checkpoint,
  recommendation,
  sharedResult: result(successful),
  nextState: "focused_coach_note",
});

async function screenshot(page, filename) {
  await page.screenshot({ path: `${OUTPUT}/${filename}`, animations: "disabled" });
}

async function contextPage(browser, { session = null, reducedMotion = "no-preference", microphone = false } = {}) {
  const context = await browser.newContext({ viewport: VIEWPORT, reducedMotion, permissions: microphone ? ["microphone"] : [] });
  await context.addInitScript(({ profile, session }) => {
    localStorage.clear();
    if (session) {
      localStorage.setItem("cc.profile.v1", JSON.stringify(profile));
      localStorage.setItem("cc.activePracticeSession.v1", JSON.stringify(session));
      localStorage.setItem("cc.anonymousUserId.v1", session.anonymousUserId);
    }
  }, { profile, session });
  const page = await context.newPage();
  return { context, page };
}

async function open(page, path = "/", wait = 3800) {
  await page.goto(`${BASE_URL}${path}`);
  await page.waitForTimeout(wait);
}

async function captureOnboarding(browser) {
  const { context, page } = await contextPage(browser);
  await open(page);
  await screenshot(page, "01-opening.png");
  await page.getByRole("button", { name: "Build my communication skills" }).click();
  await page.waitForTimeout(400);
  await screenshot(page, "02-route-selection.png");
  await page.getByRole("button", { name: "I have a conversation I need to prepare for" }).click();
  await page.waitForTimeout(400);
  await screenshot(page, "03-real-conversation-questions.png");
  await context.close();

  const recurring = await contextPage(browser);
  await open(recurring.page);
  await recurring.page.getByRole("button", { name: "Build my communication skills" }).click();
  await recurring.page.getByRole("button", { name: "The same communication problem keeps happening" }).click();
  await recurring.page.waitForTimeout(400);
  await screenshot(recurring.page, "04-recurring-problem-questions.png");
  await recurring.context.close();

  const desired = await contextPage(browser);
  await open(desired.page);
  await desired.page.getByRole("button", { name: "Build my communication skills" }).click();
  await desired.page.getByRole("button", { name: "I know what I want to get better at" }).click();
  await desired.page.waitForTimeout(400);
  await screenshot(desired.page, "05-desired-skill-questions.png");
  await desired.context.close();
}

async function captureRehearsal(browser) {
  const briefingSession = { ...baseSession, freeJourneyCheckpoint: "rehearsal" };
  const briefing = await contextPage(browser, { session: briefingSession });
  await open(briefing.page, `/rehearse/${baseSession.scenarioId}?entry=onboarding&practiceSessionId=${baseSession.id}&persona=woman-hope&reaction=defensive`);
  await screenshot(briefing.page, "06-briefing.png");
  await briefing.context.close();

  const spoken = await contextPage(browser, { session: briefingSession, microphone: true });
  await open(spoken.page, `/rehearse/${baseSession.scenarioId}?entry=onboarding&practiceSessionId=${baseSession.id}&persona=woman-hope&reaction=defensive`);
  await spoken.page.getByRole("button", { name: "Record your line" }).click();
  await spoken.page.waitForTimeout(700);
  await screenshot(spoken.page, "07-spoken-capture.png");
  await spoken.context.close();

  const typed = await contextPage(browser, { session: briefingSession });
  await open(typed.page, `/rehearse/${baseSession.scenarioId}?entry=onboarding&practiceSessionId=${baseSession.id}&persona=woman-hope&reaction=defensive`);
  await typed.page.getByRole("button", { name: "Type instead" }).click();
  await typed.page.waitForTimeout(300);
  await screenshot(typed.page, "08-typed-fallback.png");
  await typed.page.getByLabel("Type your line").fill(turns[0].text);
  await screenshot(typed.page, "09-user-turn-one-review-edit.png");
  await typed.context.close();

  const pushed = await contextPage(browser, { session: { ...briefingSession, freeRehearsalTurns: turns.slice(0, 2) } });
  await open(pushed.page, `/rehearse/${baseSession.scenarioId}?entry=onboarding&practiceSessionId=${baseSession.id}&persona=woman-hope&reaction=defensive`);
  await screenshot(pushed.page, "10-counterpart-pushback.png");
  await pushed.page.getByRole("button", { name: "Type instead" }).click();
  await pushed.page.getByLabel("Type your line").fill(turns[2].text);
  await screenshot(pushed.page, "11-user-turn-two-review-edit.png");
  await pushed.context.close();

  const complete = await contextPage(browser, { session: { ...briefingSession, freeRehearsalTurns: turns, freeJourneyCheckpoint: "transcript_review" } });
  await open(complete.page, `/rehearse/${baseSession.scenarioId}?entry=onboarding&practiceSessionId=${baseSession.id}&persona=woman-hope&reaction=defensive`);
  await complete.page.getByRole("button", { name: "Review complete transcript" }).click();
  await complete.page.waitForTimeout(300);
  await screenshot(complete.page, "12-complete-transcript-approval.png");
  await complete.page.getByRole("button", { name: "Approve transcript" }).click();
  await complete.page.waitForTimeout(900);
  await screenshot(complete.page, "13-generating.png");
  await complete.context.close();
}

async function captureResults(browser) {
  const pressure = await contextPage(browser, { session: completedSession("pressure_moment", true) });
  await open(pressure.page, `/debrief/${baseSession.id}`);
  await screenshot(pressure.page, "14-pressure-moment-collapsed.png");
  await pressure.page.getByRole("button", { name: "How BYSI read this" }).click();
  await pressure.page.waitForTimeout(250);
  await screenshot(pressure.page, "15-pressure-moment-expanded.png");
  await pressure.context.close();

  const shift = await contextPage(browser, { session: completedSession("practice_shift", true) });
  await open(shift.page, `/debrief/${baseSession.id}`);
  await screenshot(shift.page, "16-practice-shift-narrow.png");
  await shift.context.close();

  const successful = await contextPage(browser, { session: completedSession("starting_index", true) });
  await open(successful.page, `/debrief/${baseSession.id}`);
  await screenshot(successful.page, "17-successful-partial-starting-index.png");
  await successful.page.getByRole("button", { name: "See my practice path" }).click();
  await successful.page.waitForTimeout(350);
  await screenshot(successful.page, "19-practice-path-second-card.png");
  await successful.page.getByRole("button", { name: "Back to Starting Index" }).click();
  await successful.page.waitForTimeout(350);
  if (!(await successful.page.getByText("3 of 6 signals observed").isVisible())) throw new Error("Reverse card interaction did not restore the Starting Index.");
  await successful.context.close();

  const insufficient = await contextPage(browser, { session: completedSession("starting_index", false) });
  await open(insufficient.page, `/debrief/${baseSession.id}`);
  await screenshot(insufficient.page, "18-insufficient-evidence-starting-index.png");
  await insufficient.context.close();

  const reduced = await contextPage(browser, { session: completedSession("starting_index", true), reducedMotion: "reduce" });
  await open(reduced.page, `/debrief/${baseSession.id}`);
  await reduced.page.getByRole("button", { name: "See my practice path" }).click();
  await reduced.page.waitForTimeout(50);
  if (!(await reduced.page.getByText("Your practice path").isVisible())) throw new Error("Reduced motion hid the practice-path state.");
  await reduced.page.getByRole("button", { name: "Back to Starting Index" }).click();
  await reduced.page.waitForTimeout(50);
  if (!(await reduced.page.getByText("3 of 6 signals observed").isVisible())) throw new Error("Reduced motion hid the Starting Index state.");
  await reduced.context.close();
}

async function captureRecovery(browser) {
  const briefingSession = { ...baseSession, freeJourneyCheckpoint: "rehearsal" };
  const safety = await contextPage(browser, { session: briefingSession });
  await open(safety.page, `/rehearse/${baseSession.scenarioId}?entry=onboarding&practiceSessionId=${baseSession.id}&persona=woman-hope&reaction=defensive`);
  await safety.page.getByText("This doesn’t feel safe").click();
  await safety.page.waitForTimeout(350);
  await screenshot(safety.page, "20-safety-resources.png");
  await safety.context.close();

  const privacy = await contextPage(browser, { session: briefingSession });
  await open(privacy.page, `/rehearse/${baseSession.scenarioId}?entry=onboarding&practiceSessionId=${baseSession.id}&persona=woman-hope&reaction=defensive`);
  await privacy.page.getByText("Privacy & details").click();
  await privacy.page.waitForTimeout(350);
  await screenshot(privacy.page, "21-privacy-details.png");
  await privacy.context.close();

  const denied = await contextPage(browser, { session: briefingSession });
  await open(denied.page, `/rehearse/${baseSession.scenarioId}?entry=onboarding&practiceSessionId=${baseSession.id}&persona=woman-hope&reaction=defensive`);
  await denied.page.getByRole("button", { name: "Record your line" }).click();
  await denied.page.waitForTimeout(700);
  await screenshot(denied.page, "22-microphone-denied.png");
  await denied.context.close();

  const failure = await contextPage(browser, { session: briefingSession });
  await open(failure.page, `/rehearse/${baseSession.scenarioId}?entry=onboarding&practiceSessionId=${baseSession.id}&persona=woman-hope&reaction=defensive`);
  await failure.page.getByRole("button", { name: "Type instead" }).click();
  await failure.page.getByLabel("Type your line").fill(turns[0].text);
  await failure.page.locator('[role="button"]').last().click();
  await failure.page.waitForTimeout(15000);
  if (!(await failure.page.getByText("CONNECTION LOST").isVisible())) throw new Error("The deterministic connection-failure state was not reached.");
  await screenshot(failure.page, "23-generation-connection-failure.png");
  await failure.context.close();
}

const browser = await chromium.launch({
  headless: true,
  args: ["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream"],
});
try {
  if (group === "all" || group === "onboarding") await captureOnboarding(browser);
  if (group === "all" || group === "rehearsal") await captureRehearsal(browser);
  if (group === "all" || group === "results") await captureResults(browser);
  if (group === "all" || group === "recovery") await captureRecovery(browser);
} finally {
  await browser.close();
}
