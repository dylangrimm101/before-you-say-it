import { describe, expect, it } from "bun:test";

import { fallbackCustomScenario } from "@/lib/ai";
import {
  BLANK_SAFETY_ANSWERS,
  SAFETY_QUESTIONS,
  allowsOrdinaryPractice,
  routeFor,
  type SafetyAnswers,
} from "@/lib/safety";

function answers(patch: Partial<SafetyAnswers>): SafetyAnswers {
  return { ...BLANK_SAFETY_ANSWERS, ...patch };
}

/** Every combination of the boolean answer set. */
function allCombinations(): SafetyAnswers[] {
  const keys = Object.keys(BLANK_SAFETY_ANSWERS) as (keyof SafetyAnswers)[];
  const out: SafetyAnswers[] = [];
  for (let mask = 0; mask < 2 ** keys.length; mask += 1) {
    const a = { ...BLANK_SAFETY_ANSWERS };
    keys.forEach((k, i) => {
      a[k] = Boolean(mask & (1 << i));
    });
    out.push(a);
  }
  return out;
}

describe("safety questions", () => {
  it("covers every answer field exactly once", () => {
    const ids = SAFETY_QUESTIONS.map((q) => q.id).sort();
    const fields = (Object.keys(BLANK_SAFETY_ANSWERS) as string[]).sort();
    expect(ids).toEqual(fields);
  });

  it("defaults every answer to false", () => {
    expect(Object.values(BLANK_SAFETY_ANSWERS).every((v) => v === false)).toBe(true);
  });
});

describe("routeFor", () => {
  it("lets a clean answer set proceed", () => {
    expect(routeFor(BLANK_SAFETY_ANSWERS).route).toBe("proceed");
    expect(allowsOrdinaryPractice(routeFor(BLANK_SAFETY_ANSWERS).route)).toBe(true);
  });

  it("routes immediate danger to emergency support above everything else", () => {
    expect(routeFor(answers({ immediateDanger: true })).route).toBe("emergency_support");
    expect(
      routeFor(answers({ immediateDanger: true, workplaceOrLegalRisk: true })).route,
    ).toBe("emergency_support");
  });

  it("routes threats, violence and coercive control away from confrontation", () => {
    expect(routeFor(answers({ threatsOrViolence: true })).route).toBe("do_not_confront");
    expect(routeFor(answers({ coerciveControl: true })).route).toBe("do_not_confront");
    expect(routeFor(answers({ unsafeOrInappropriate: true })).route).toBe("do_not_confront");
  });

  it("routes workplace and legal risk to a formal channel", () => {
    expect(routeFor(answers({ workplaceOrLegalRisk: true })).route).toBe("use_formal_channel");
  });

  it("routes fear of retaliation to documenting and seeking support", () => {
    expect(routeFor(answers({ fearsRetaliation: true })).route).toBe(
      "document_and_seek_support",
    );
  });

  it("routes being too activated right now to delay and prepare", () => {
    const outcome = routeFor(answers({ feelsTooActivatedNow: true }));
    expect(outcome.route).toBe("delay_and_prepare");
    expect(allowsOrdinaryPractice(outcome.route)).toBe(true);
  });

  it("never lets any risk flag reach proceed", () => {
    allCombinations().forEach((a) => {
      const anyRisk = Object.values(a).some(Boolean);
      const route = routeFor(a).route;
      if (anyRisk) expect(route).not.toBe("proceed");
      else expect(route).toBe("proceed");
    });
  });

  it("blocks ordinary practice for every hard-stop route", () => {
    allCombinations().forEach((a) => {
      const { route } = routeFor(a);
      const hardStop =
        a.immediateDanger ||
        a.threatsOrViolence ||
        a.coerciveControl ||
        a.unsafeOrInappropriate ||
        a.workplaceOrLegalRisk ||
        a.fearsRetaliation;
      expect(allowsOrdinaryPractice(route)).toBe(!hardStop);
    });
  });

  it("always returns support copy and never echoes the answers back", () => {
    allCombinations().forEach((a) => {
      const outcome = routeFor(a);
      expect(outcome.title.length).toBeGreaterThan(0);
      expect(outcome.body.length).toBeGreaterThan(0);
      expect(JSON.stringify(outcome)).not.toContain("fearsRetaliation");
    });
  });
});

describe("onboarding reaches rehearsal through the private safety router", () => {
  const onboarding = () =>
    Bun.file(new URL("../app/onboarding.tsx", import.meta.url).pathname).text();

  it("hands off to safety without detouring through checkout", async () => {
    const source = await onboarding();
    expect(source).toContain('pathname: "/safety-check"');
    expect(source).toContain('entry: "onboarding"');
    expect(source).toContain("practiceSessionId");
    expect(source).not.toContain('"/paywall"');
    expect(source).not.toContain('"/scenario/[id]"');
  });

  it("falls back locally instead of resetting step five when generation fails", async () => {
    const source = await onboarding();
    expect(source).toContain("draft = await buildCustomScenario");
    expect(source).toContain("draft = fallbackCustomScenario(description, selectedFocus, form)");
    expect(source.indexOf("fallbackCustomScenario(description, selectedFocus, form)")).toBeLessThan(
      source.indexOf("router.replace({"),
    );
  });

  it("removes the onboarding difficulty choice and keeps generation and rehearsal steady", async () => {
    const source = await onboarding();
    expect(source).toContain('const DIFFICULTY: Difficulty = "steady"');
    expect(source).not.toContain("Practice difficulty");
    expect(source).not.toContain("setDifficulty");
    expect(source).not.toContain("DIFFICULTIES.map");
    expect(source).toContain("difficulty: DIFFICULTY");
  });

  it("the fallback preserves the user's outcome and selected voice", () => {
    const scenario = fallbackCustomScenario(
      "I need to talk about an unfair workload.",
      "work",
      {
        persona: "man-adam",
        outcome: "Agree on who owns each deadline.",
      },
    );

    expect(scenario.counterpart).toContain("Adam");
    expect(scenario.counterpartGender).toBe("man");
    expect(scenario.goal).toBe("Agree on who owns each deadline.");
    expect(scenario.situation).toBe("I need to talk about an unfair workload.");
    expect(scenario.opensWith).toBe("user");
  });
});

describe("the safety screening still exists for scenario retries", () => {
  it("renders support routes from one shared component", async () => {
    const shared = new URL("../components/SafetyOutcome.tsx", import.meta.url).pathname;
    const source = await Bun.file(shared).text();
    expect(source).toContain("allowsOrdinaryPractice");
    const consumer = await Bun.file(
      new URL("../app/safety-check.tsx", import.meta.url).pathname,
    ).text();
    expect(consumer).toContain("SafetyOutcomeView");
  });
});

describe("safety answers are ephemeral", () => {
  it("exposes no serializer, storage key or persistence helper", async () => {
    const mod = (await import("@/lib/safety")) as Record<string, unknown>;
    const exported = Object.keys(mod).join(" ").toLowerCase();
    ["persist", "save", "store", "asyncstorage", "cc."].forEach((forbidden) => {
      expect(exported).not.toContain(forbidden);
    });
  });

  it("declares no cc.* storage key anywhere in the module source", async () => {
    const source = await Bun.file(
      new URL("../lib/safety.ts", import.meta.url).pathname,
    ).text();
    expect(source).not.toContain("cc.");
    expect(source).not.toContain("AsyncStorage");
  });
});
