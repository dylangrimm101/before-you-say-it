import {
  CONVERSATION_PHASES,
  conversionEvidence,
  hasConversionOverclaim,
  selectFocusSkill,
} from "@/lib/conversion";
import {
  beginConversionBuild,
  emitConversionEvent,
  getConversionBuild,
} from "@/lib/conversionBuild";
import type { Debrief, Turn } from "@/types/convo";

const turns: Turn[] = [
  { id: "u1", role: "user", text: "Could we maybe make a plan for paying me back?" },
  { id: "a1", role: "them", text: "Sure, I’ll work something out." },
];

const debrief: Debrief = {
  headline: "The request stayed open.",
  scores: { clarity: 50, empathy: 60, assertiveness: 45, composure: 55 },
  wins: [],
  flags: [
    {
      quote: "Could we maybe make a plan for paying me back?",
      issue: "No amount or date was named.",
      reframe: "I need $840 in my account by Friday the 14th.",
    },
  ],
  script: [],
  nextRep: "Name the amount and date.",
};

describe("post-rehearsal conversion evidence", () => {
  test("uses exact transcript wording rather than fabricating a first attempt", () => {
    const evidence = conversionEvidence(turns, debrief);
    expect(evidence.learnerQuote).toBe(turns[0]?.text ?? "");
    expect(evidence.counterpartQuote).toBe(turns[1]?.text ?? "");
    expect(evidence.targetQuote).toBe(debrief.flags[0]?.reframe ?? "");
  });

  test("selects from the fixed eight-module curriculum", () => {
    expect(selectFocusSkill(debrief).id).toBe("make_a_clear_ask");
    expect(CONVERSATION_PHASES).toHaveLength(4);
    expect(CONVERSATION_PHASES[0]?.days).toBe("Modules 1–2");
    expect(CONVERSATION_PHASES[3]?.days).toBe("Modules 7–8");
  });

  test("detects prohibited conversion claims", () => {
    expect(hasConversionOverclaim("Your confidence will improve by 42%")).toBe(true);
    expect(hasConversionOverclaim("Ask for a specific commitment.")).toBe(false);
  });
});

describe("event-driven plan build", () => {
  test("opens with no completed artifacts and advances on named events", () => {
    beginConversionBuild({ id: "reh-test", scenarioTitle: "A hard ask", counterpartName: "Adam", turns });
    expect(getConversionBuild("reh-test")?.events).toEqual([]);

    emitConversionEvent("reh-test", "transcript.confirmed");
    emitConversionEvent("reh-test", "exchange.paired");
    emitConversionEvent("reh-test", "skill.identified", debrief);
    emitConversionEvent("reh-test", "path.mapped");
    emitConversionEvent("reh-test", "plan.ready");

    expect(getConversionBuild("reh-test")?.events).toEqual([
      "transcript.confirmed",
      "exchange.paired",
      "skill.identified",
      "path.mapped",
      "plan.ready",
    ]);
    expect(getConversionBuild("reh-test")?.debrief).toBe(debrief);
  });

  test("ignores duplicated and out-of-order pipeline events", () => {
    beginConversionBuild({ id: "reh-order", scenarioTitle: "A hard ask", counterpartName: "Adam", turns });
    emitConversionEvent("reh-order", "skill.identified", debrief);
    emitConversionEvent("reh-order", "transcript.confirmed");
    emitConversionEvent("reh-order", "transcript.confirmed");
    expect(getConversionBuild("reh-order")?.events).toEqual(["transcript.confirmed"]);
  });

  test("presents named events from top to bottom without staged timers", async () => {
    const screen = await Bun.file(`${import.meta.dir}/../app/debrief/[id].tsx`).text();
    expect(screen).not.toContain("setTimeout");
    expect(screen).not.toContain("setInterval");
    expect(screen).toContain("const [completedCount, setCompletedCount] = useState<number>(0)");
    expect(screen).toContain("const availableCount = Math.min(build.events.length, PIPELINE_ROWS.length)");
    expect(screen).toContain("if (completedCount >= availableCount) return");
    expect(screen).toContain("presentCompletedEvent.start");
    expect(screen).toContain('status === "done" ? 100 : status === "active" ? 8 : 0');
    expect(screen).toContain('<View style={styles.referencePipelineCheck}><Check');
    expect(screen).toContain('status === "queued" && styles.referencePipelineQueued');
    expect(screen).toContain('build.events.includes("plan.ready")');
  });

  test("matches the web loading copy and automatically hands off to the baseline", async () => {
    const screen = await Bun.file(`${import.meta.dir}/../app/debrief/[id].tsx`).text();
    expect(screen).toContain('Personalizing your{"\\n"}');
    expect(screen).toContain("practice plan…");
    expect(screen).toContain("You did the hard part. Practicing it out loud is the step most people skip.");
    expect(screen).toContain("Reading your pressure pattern");
    expect(screen).toContain("Finding where the conversation stalled");
    expect(screen).toContain("Choosing the first skill to train");
    expect(screen).toContain("Finalizing your report");
    expect(screen).not.toContain("Only approved text is used.");
    expect(screen).toContain("if (!isReady) return");
    expect(screen).toContain("revealDebrief()");
  });

  test("shows the active analysis row at eight percent before handing off", async () => {
    const screen = await Bun.file(`${import.meta.dir}/../app/debrief/[id].tsx`).text();
    expect(screen).toContain('status === "done" ? 100 : status === "active" ? 8 : 0');
    expect(screen).toContain("styles.referencePipelineActive");
    expect(screen).toContain("styles.referencePipelinePercent");
    expect(screen).toContain("styles.referencePipelineTrack");
    expect(screen).toContain("styles.referencePipelineFill");
  });

  test("emits the first event only after the empty plan screen mounts", async () => {
    const rehearsal = await Bun.file(`${import.meta.dir}/../app/rehearse/[id].tsx`).text();
    expect(rehearsal.indexOf("router.replace(`/debrief/${id}`)")).toBeLessThan(
      rehearsal.indexOf('emitConversionEvent(id, "transcript.confirmed")'),
    );
  });

  test("keeps every phase bar on one baseline and builds the graph left to right", async () => {
    const screen = await Bun.file(`${import.meta.dir}/../app/debrief/[id].tsx`).text();
    expect(screen).toContain("<View style={styles.graphBars}>");
    expect(screen).toContain("<View style={styles.graphLabels}>");
    expect(screen).toContain('graphBars: { height: 96, flexDirection: "row", alignItems: "flex-end"');
    expect(screen).toContain('barColumn: { flex: 1, height: 96, justifyContent: "flex-end" }');
    expect(screen).toContain("const leftToRightBuild = Animated.stagger(\n      110,");
    expect(screen).toContain("leftToRightBuild.start()");
    expect(screen).toContain("return () => leftToRightBuild.stop()");
  });
});

describe("conversion paywall", () => {
  test("preserves the free debrief and sells spoken repetition", async () => {
    const source = await Bun.file(`${import.meta.dir}/../app/paywall.tsx`).text();
    expect(source).toContain("Your practice plan");
    expect(source).toContain("Keep my free debrief for now");
    expect(source).toContain("One evidence-linked adjustment, then the same moment again.");
  });

  test("uses a real purchase—not preview access—to bypass the paywall", async () => {
    const debrief = await Bun.file(`${import.meta.dir}/../app/debrief/[id].tsx`).text();
    expect(debrief).toContain("const hasPurchasedPro = useIsPro();");
    expect(debrief).toContain("if (!hasPurchasedPro)");
    expect(debrief).toContain('pathname: "/paywall"');
    expect(debrief).not.toContain("isPro(access.entitlement)");
  });

  test("confirms activation and opens the recommended module without replaying onboarding", async () => {
    const paywall = await Bun.file(`${import.meta.dir}/../app/paywall.tsx`).text();
    const success = await Bun.file(`${import.meta.dir}/../app/purchase-success.tsx`).text();
    expect(paywall).toContain('pathname: "/purchase-success"');
    expect(paywall).toContain("moduleId ? { moduleId } : {}");
    expect(success).toContain("Subscription active");
    expect(success).toContain("Recommended starting module");
    expect(success).toContain('pathname: "/module/[day]"');
    expect(success).toContain("day: moduleId");
    expect(success).not.toContain("Continue to Day 1");
  });
});
