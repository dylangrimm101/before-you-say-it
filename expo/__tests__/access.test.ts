import { describe, expect, it } from "bun:test";

import {
  FREE_REHEARSAL_USER_TURNS,
  PRACTICE_PATH_QUALIFIER,
  RETRY_CTA,
  canContinuePilot,
  canContinueProgram,
  canRetryRehearsal,
  canSeeTargetedFeedback,
  canStartRehearsal,
  freeRepsRemaining,
  gateCopy,
  isPro,
  practicePath,
  rehearsalTurnCap,
  type AccessState,
  type GateId,
} from "@/lib/access";

const free = (completedReps: number): AccessState => ({
  entitlement: "free",
  completedReps,
});

const pro = (completedReps: number): AccessState => ({
  entitlement: "pro",
  completedReps,
});

const GATES: GateId[] = ["retry", "another-rehearsal", "targeted-feedback", "program"];

describe("the free tier includes one complete conversation", () => {
  it("lets a brand-new free account start its first rehearsal", () => {
    expect(canStartRehearsal(free(0)).allowed).toBe(true);
  });

  it("lets a free account reach the end of the first rehearsal", () => {
    // Mid-rehearsal, nothing is completed yet, so nothing may interrupt.
    expect(canStartRehearsal(free(0)).allowed).toBe(true);
    expect(freeRepsRemaining(free(0))).toBe(1);
  });

  it("counts only finished reps, so abandoning one does not burn it", () => {
    expect(freeRepsRemaining(free(0))).toBe(1);
    expect(freeRepsRemaining(free(1))).toBe(0);
  });

  it("blocks a second rehearsal once the first is complete", () => {
    const decision = canStartRehearsal(free(1));
    expect(decision.allowed).toBe(false);
    expect(decision.gate).toBe("another-rehearsal");
  });

  it("never reports negative remaining reps", () => {
    expect(freeRepsRemaining(free(7))).toBe(0);
  });
});

describe("a free rehearsal is a fixed exchange, not an open-ended chat", () => {
  it("caps free accounts at a small, fixed number of user turns", () => {
    expect(rehearsalTurnCap("free")).toBe(FREE_REHEARSAL_USER_TURNS);
    expect(FREE_REHEARSAL_USER_TURNS).toBeGreaterThan(0);
  });

  it("never caps a paid account", () => {
    expect(rehearsalTurnCap("pro")).toBeNull();
  });
});

describe("retrying is always paid", () => {
  it("blocks a free retry even on the very first debrief", () => {
    const decision = canRetryRehearsal(free(1));
    expect(decision.allowed).toBe(false);
    expect(decision.gate).toBe("retry");
  });

  it("blocks a free retry even when no rep has been completed", () => {
    expect(canRetryRehearsal(free(0)).allowed).toBe(false);
  });

  it("allows a paid retry", () => {
    expect(canRetryRehearsal(pro(1)).allowed).toBe(true);
  });
});

describe("paid accounts are never gated", () => {
  it("allows every capability regardless of history", () => {
    [0, 1, 40].forEach((n) => {
      expect(canStartRehearsal(pro(n)).allowed).toBe(true);
      expect(canRetryRehearsal(pro(n)).allowed).toBe(true);
      expect(canContinueProgram(pro(n)).allowed).toBe(true);
      expect(canContinuePilot(pro(n)).allowed).toBe(true);
      expect(canSeeTargetedFeedback(pro(n)).allowed).toBe(true);
    });
  });

  it("reports unlimited reps", () => {
    expect(freeRepsRemaining(pro(3))).toBe(Infinity);
  });

  it("identifies the entitlement", () => {
    expect(isPro("pro")).toBe(true);
    expect(isPro("free")).toBe(false);
  });
});

describe("curriculum access starts behind the paid boundary", () => {
  it("does not treat paid Module 1 as a second free experience", () => {
    const beforeOnboarding = canContinueProgram(free(0));
    const afterOnboarding = canContinueProgram(free(1));
    expect(beforeOnboarding).toEqual({ allowed: false, gate: "program" });
    expect(afterOnboarding).toEqual({ allowed: false, gate: "program" });
  });

  it("keeps every module in the eight-module curriculum paid", () => {
    expect(canContinuePilot(free(0))).toEqual({ allowed: false, gate: "program" });
    expect(canContinuePilot(free(1))).toEqual({ allowed: false, gate: "program" });
  });

  it("keeps the free onboarding rehearsal separate from curriculum access", () => {
    expect(canStartRehearsal(free(0)).allowed).toBe(true);
    expect(canContinuePilot(free(0)).allowed).toBe(false);
    expect(canStartRehearsal(free(1)).allowed).toBe(false);
    expect(canContinuePilot(pro(1)).allowed).toBe(true);
  });
});

describe("preview pilot access", () => {
  it("offers an explicit no-purchase unlock and honors it across pilot entry points", async () => {
    const paywall = await Bun.file(`${import.meta.dir}/../app/paywall.tsx`).text();
    const module = await Bun.file(`${import.meta.dir}/../app/module/[day].tsx`).text();
    const today = await Bun.file(`${import.meta.dir}/../app/(tabs)/index.tsx`).text();
    const store = await Bun.file(`${import.meta.dir}/../providers/store.tsx`).text();

    expect(paywall).toContain('label="Unlock all modules for testing"');
    expect(paywall).toContain("await toggleDevPro(true)");
    expect(paywall).toContain("Preview only · no purchase or subscription");
    expect(module).toContain("const decision = canContinuePilot(access)");
    expect(module).toContain("if (!decision.allowed)");
    expect(module).not.toContain("const hasPurchasedPro = useIsPro()");
    expect(today).toContain('access.entitlement !== "pro"');
    expect(store).toContain('purchasedPro || (__DEV__ && devPro) ? "pro" : "free"');
  });

  it("keeps the tester entitlement development-only", async () => {
    const paywall = await Bun.file(`${import.meta.dir}/../app/paywall.tsx`).text();
    const store = await Bun.file(`${import.meta.dir}/../providers/store.tsx`).text();
    expect(paywall).toContain("if (!__DEV__) return");
    expect(paywall).toContain("{__DEV__ && !devProEnabled ? (");
    expect(store).toContain("if (!__DEV__) return");
    expect(store).toContain("__DEV__ ? AsyncStorage.getItem(KEYS.devPro) : Promise.resolve(null)");
    expect(store).toContain('purchasedPro || (__DEV__ && devPro) ? "pro" : "free"');
  });

  it("keeps RevenueCat configuration identifiers unchanged", async () => {
    const purchases = await Bun.file(`${import.meta.dir}/../lib/purchases.ts`).text();
    const paywall = await Bun.file(`${import.meta.dir}/../app/paywall.tsx`).text();
    expect(purchases).toContain('export const PRO_ENTITLEMENT = "pro"');
    expect(purchases).toContain("EXPO_PUBLIC_REVENUECAT_TEST_API_KEY");
    expect(purchases).toContain("EXPO_PUBLIC_REVENUECAT_IOS_API_KEY");
    expect(purchases).toContain("EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY");
    expect(paywall).toContain("current?.monthly");
    expect(paywall).toContain("current?.annual");
    expect(purchases).not.toContain("productIdentifier ===");
  });
});

describe("gate copy", () => {
  it("provides distinct, non-empty copy for every gate", () => {
    const headlines = new Set<string>();
    GATES.forEach((g) => {
      const copy = gateCopy(g);
      expect(copy.eyebrow.length, g).toBeGreaterThan(0);
      expect(copy.headline.length, g).toBeGreaterThan(0);
      expect(copy.body.length, g).toBeGreaterThan(20);
      headlines.add(copy.headline);
    });
    expect(headlines.size).toBe(GATES.length);
  });

  it("never scolds the user for hitting a limit", () => {
    const banned = [
      "run out",
      "ran out",
      "you have used",
      "limit reached",
      "no more",
      "upgrade now",
      "free trial expired",
    ];
    GATES.forEach((g) => {
      const all = Object.values(gateCopy(g)).join(" ").toLowerCase();
      banned.forEach((phrase) => {
        expect(all.includes(phrase), `${g} contains "${phrase}"`).toBe(false);
      });
    });
  });

  it("calls the program by its name, never a challenge", () => {
    const all = GATES.map((g) => Object.values(gateCopy(g)).join(" ")).join(" ");
    expect(all.toLowerCase()).not.toContain("challenge");
    expect(gateCopy("program").eyebrow).toContain("30-Day Conversation Practice");
  });

  it("uses American spelling", () => {
    const all = GATES.map((g) => Object.values(gateCopy(g)).join(" ")).join(" ");
    ["practise", "behaviour", "realise", "cancelled", "favourite"].forEach((w) => {
      expect(all.toLowerCase()).not.toContain(w);
    });
  });
});

describe("the retry CTA", () => {
  it("invites practice rather than a repeat", () => {
    expect(RETRY_CTA.label).toBe("Practice the better version");
    expect(RETRY_CTA.label.toLowerCase()).not.toContain("run it again");
  });

  it("names the moment the user just found", () => {
    expect(RETRY_CTA.support).toContain("changed the conversation");
  });
});

describe("the practice path", () => {
  const path = practicePath();

  it("has exactly three milestones", () => {
    expect(path.length).toBe(3);
  });

  it("moves from today to thirty days to continued practice", () => {
    expect(path[0]?.when).toBe("Today");
    expect(path[1]?.when).toContain("30 days");
    expect(path[2]?.when).toContain("continued practice");
  });

  it("promises no numbers, scores or percentages", () => {
    path.forEach((m) => {
      const text = `${m.when} ${m.detail}`;
      // "30 days" is the program length, not a predicted result.
      const withoutProgramLength = text.replace(/30 days/g, "");
      expect(/\d/.test(withoutProgramLength), text).toBe(false);
      expect(text).not.toContain("%");
    });
  });

  it("never guarantees an outcome", () => {
    const all = path.map((m) => m.detail.toLowerCase()).join(" ");
    ["guarantee", "will win", "always work", "never fail", "proven to"].forEach((p) => {
      expect(all).not.toContain(p);
    });
  });

  it("describes capabilities, not scores", () => {
    const all = path.map((m) => m.detail.toLowerCase()).join(" ");
    ["your score", "points", "rating", "improve by"].forEach((p) => {
      expect(all).not.toContain(p);
    });
  });

  it("qualifies the projection honestly", () => {
    expect(PRACTICE_PATH_QUALIFIER).toContain("depends on");
    expect(PRACTICE_PATH_QUALIFIER).toContain("consistently");
  });
});
