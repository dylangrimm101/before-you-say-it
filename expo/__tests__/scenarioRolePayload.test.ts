import { afterEach, describe, expect, test } from "bun:test";

import { DIFFICULTY, SCENARIOS } from "@/constants/scenarios";
import { counterpartLinePassesQuality, nextCounterpartTurn } from "@/lib/ai";
import type { Difficulty } from "@/types/convo";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("standalone scenario role grounding", () => {
  test("sends identity, authored persona, opening, difficulty, reaction, goal, and transcript for all scenarios", async () => {
    const payloads: Record<string, unknown>[] = [];
    globalThis.fetch = (async (_input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      payloads.push(JSON.parse(String(init?.body)) as Record<string, unknown>);
      return new Response(JSON.stringify({ mode: "turn", text: "What exactly are you asking me to change?" }), { status: 200 });
    }) as typeof fetch;

    const difficulties: Difficulty[] = ["gentle", "steady", "challenging"];
    for (const scenario of SCENARIOS) {
      for (const difficulty of difficulties) {
        await nextCounterpartTurn(
          scenario,
          difficulty,
          [{ id: `${scenario.id}-${difficulty}`, role: "user", text: "I want to talk about what needs to change." }],
          "defensive",
        );
        const payload = payloads.at(-1)!;
        const contract = payload.contract as Record<string, unknown>;
        const transcript = payload.transcript as Record<string, unknown>;
        expect(contract.counterpart, scenario.id).toBe(scenario.counterpart);
        expect(contract.counterpart_persona, scenario.id).toBe(scenario.persona);
        expect(contract.difficulty, scenario.id).toBe(difficulty);
        expect(contract.difficulty_behavior, scenario.id).toBe(DIFFICULTY[difficulty].behaviour);
        expect(contract.reaction_pattern, scenario.id).toBe("defensive");
        expect(contract.opens_with, scenario.id).toBe(scenario.opensWith ?? "user");
        expect(contract.opening_line, scenario.id).toBe(scenario.openingLine);
        expect(contract.success_target, scenario.id).toBe(scenario.goal);
        expect(String(contract.pressure_condition), scenario.id).toContain(scenario.persona);
        expect(String(contract.pressure_condition), scenario.id).toContain(DIFFICULTY[difficulty].behaviour);
        expect(String(contract.pressure_condition), scenario.id).toContain("You get defensive quickly");
        expect(String(contract.pressure_condition), scenario.id).toContain("Scenario facts and persona are authoritative");
        expect(String(contract.pressure_condition), scenario.id).toContain("Use difficulty only to scale resistance");
        expect(String(contract.pressure_condition), scenario.id).toContain("Use the reaction tendency only when it does not contradict the scenario");
        expect(String(contract.scenario), scenario.id).toContain(scenario.counterpart);
        expect(transcript.user_turn_1, scenario.id).toBe("I want to talk about what needs to change.");
        expect(transcript.counterpart_pushback, scenario.id).toBe(scenario.opensWith === "counterpart" ? scenario.openingLine : "");
        expect(transcript.counterpart_close, scenario.id).toBe("");
      }
    }
    expect(payloads).toHaveLength(SCENARIOS.length * difficulties.length);
  });

  test("rejects coaching and role leakage from standalone counterpart replies", () => {
    for (const line of [
      "Good job. Try saying your request more clearly.",
      "As your coach, I think you should validate me first.",
      "As an AI language model, I can role-play this scenario.",
    ]) {
      expect(counterpartLinePassesQuality(line, "pushback"), line).toBe(false);
    }
  });

  test("scales resistance without overriding the authored persona", () => {
    expect(DIFFICULTY.gentle.behaviour).toContain("authored persona");
    expect(DIFFICULTY.steady.behaviour).toContain("authored persona");
    expect(DIFFICULTY.challenging.behaviour).toContain("authored persona");
    expect(DIFFICULTY.challenging.behaviour).toContain("never invent blame, threats, old grievances");
  });

  test("allows authored communication channels but rejects invented channel changes", () => {
    const privateNews = SCENARIOS.find((scenario) => scenario.id === "private-news-boundary")!;
    const context = `${privateNews.title} ${privateNews.situation} ${privateNews.persona} ${privateNews.openingLine}`;
    expect(counterpartLinePassesQuality("Your message sounded serious, so I told one person.", "pushback", context)).toBe(true);
    expect(counterpartLinePassesQuality("I already emailed everyone about it.", "pushback", context)).toBe(false);
    expect(counterpartLinePassesQuality("I sent your news in a DM.", "pushback", context)).toBe(false);
    expect(counterpartLinePassesQuality("I texted everyone about it.", "pushback", context)).toBe(false);
    expect(counterpartLinePassesQuality("Let’s move this to chat.", "pushback", context)).toBe(false);
    expect(counterpartLinePassesQuality("Let’s move this to a video call.", "pushback", context)).toBe(false);
    const reconnect = SCENARIOS.find((scenario) => scenario.id === "reconnect-after-silence")!;
    expect(counterpartLinePassesQuality("I stopped sending messages because I never heard back.", "pushback", `${reconnect.situation} ${reconnect.persona}`)).toBe(true);
  });
});
