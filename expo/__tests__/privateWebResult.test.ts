import { describe, expect, test } from "bun:test";

// Synthetic contract fixture, never customer/provider evidence.
export function privateResultFixture() {
  return {
    schema_version: 1, kind: "bysi_private_web_result",
    provenance: { generation_id: "fixture-generation", rehearsal_id: "fixture-rehearsal", provider_request_id: "fixture-request", model: "fixture-model", generated_at: "2026-09-06T12:00:00.000Z", producer_version: "fixture-v1", source: "server_generation" },
    result: {
      mode: "result", outputVersion: "bysi-free-rehearsal-result-v1-2026-08-12",
      pressure_moment: { headline: "  Exact headline — unchanged  ", conclusion: "Stored conclusion", how_bysi_read_this: { observed: "Stored observation", why_it_matters: "Stored reason", confidence: "Limited evidence" } },
      practice_shift: { headline: "Stored shift", current_pattern: ["First", "Second", "Third"], practice_target: ["Target one", "Target two", "Target three", "Target four"], goal_line: "Stored goal", honesty_note: "Not a measured gain" },
      starting_index: { overall: null as number | null, label: "Starting Index", coverage_note: "Partial coverage", score_note: "Stored score caveat", focus_dimension: "Repair", observed_dimensions: [{ name: "Clarity", score: 43.25, evidence: "Exact evidence" }], unobserved_dimensions: ["Specificity", "Listening", "Steadiness", "Boundaries", "Repair"] },
      recommended_path: { first_module: "Get to the Point", reason: "Exact recommendation", next_modules: ["Repair What Went Wrong"] },
    },
  };
}

async function adapter() {
  const path = `${import.meta.dir}/../lib/privateWebResult.ts`;
  expect(await Bun.file(path).exists(), "dedicated restoration adapter exists").toBe(true);
  return import(path);
}

describe("private web-result restoration", () => {
  test("renders exact stored result text in a result-only presentation, not a completed rehearsal", async () => {
    const path = `${import.meta.dir}/../components/PrivateWebResultPresentation.tsx`;
    expect(await Bun.file(path).exists(), "result-only presentation exists").toBe(true);
    const { PrivateWebResultPresentation } = await import(path);
    const React = await import("react");
    const { renderToStaticMarkup } = await import("react-dom/server");
    const record = privateResultFixture();
    const render = (value: unknown) => renderToStaticMarkup(React.createElement(PrivateWebResultPresentation, { record: value, Container: "section", Text: "p" }));
    const html = render(record);
    const strings = (value: unknown): string[] => typeof value === "string" ? [value] : Array.isArray(value) ? value.flatMap(strings) : value && typeof value === "object" ? Object.values(value).flatMap(strings) : [];
    for (const text of strings({ ...record.result, mode: undefined, outputVersion: undefined })) expect(html).toContain(text);
    expect(html).toContain("Not scored");
    expect(html).toContain("43.25");
    expect(html).toContain("Transcript and rewrite are not included in this saved result.");
    expect(html).not.toContain(record.provenance.generation_id);
    expect(html).not.toContain("href=");
    expect(html).not.toContain("button");
    expect(html.indexOf("Target one")).toBeLessThan(html.indexOf("Target four"));
    record.result.starting_index.overall = 0;
    expect(render(record)).not.toContain("Not scored");
    expect(render(record)).toContain(">0<");
    expect(render({})).toContain("Saved result unavailable");
    expect(render({})).not.toContain("Starting Index");
  });
  test("projects nested private allowlists and enforces the v1 UTF-8 record limit", async () => {
    const { restorePrivateWebResult } = await adapter();
    const expected = privateResultFixture();
    const dirty: any = privateResultFixture();
    dirty.transcript = "private speech";
    dirty.provenance.email = "private@example.test";
    dirty.result.rewrite = "invented rewrite";
    dirty.result.pressure_moment.ask = "private ask";
    dirty.result.pressure_moment.how_bysi_read_this.secret = "private context";
    dirty.result.practice_shift.transcript = "private speech";
    dirty.result.starting_index.observed_dimensions[0].turn_id = "invented-id";
    dirty.result.recommended_path.practice_id = "guessed-id";
    expect(restorePrivateWebResult(dirty)).toEqual(expected);
    const large = privateResultFixture();
    large.result.practice_shift.current_pattern = Array(4).fill("界".repeat(4096));
    large.result.practice_shift.practice_target = Array(4).fill("界".repeat(4096));
    expect(() => restorePrivateWebResult(large)).toThrow("Invalid private web result");
    expect(() => restorePrivateWebResult(JSON.stringify(large))).toThrow("Invalid private web result");
  });
  test("rejects malformed, incompatible, coerced and incomplete records without fallback", async () => {
    const { restorePrivateWebResult } = await adapter();
    const mutations: ((r: any) => void)[] = [
      r => { r.schema_version = 2; }, r => { r.kind = "shared_product"; },
      r => { r.provenance.source = "browser"; }, r => { r.provenance.generation_id = "bad id"; },
      r => { r.provenance.generated_at = "not-a-date"; }, r => { delete r.provenance.model; },
      r => { r.result.mode = "safety"; }, r => { r.result.outputVersion = "future"; },
      r => { delete r.result.pressure_moment.conclusion; }, r => { r.result.pressure_moment.headline = " "; },
      r => { r.result.pressure_moment.how_bysi_read_this.confidence = 1; },
      r => { r.result.practice_shift.current_pattern = ["one", "two"]; },
      r => { r.result.practice_shift.practice_target = Array(5).fill("step"); },
      r => { r.result.starting_index.overall = "45"; }, r => { r.result.starting_index.overall = -1; },
      r => { delete r.result.starting_index.observed_dimensions[0].score; },
      r => { r.result.starting_index.observed_dimensions[0].score = "45"; },
      r => { r.result.starting_index.observed_dimensions[0].score = Infinity; },
      r => { r.result.starting_index.observed_dimensions[0].score = 101; },
      r => { r.result.starting_index.unobserved_dimensions[0] = "Clarity"; },
      r => { r.result.starting_index.unobserved_dimensions.pop(); },
      r => { r.result.starting_index.focus_dimension = "Unknown"; },
      r => { r.result.recommended_path.first_module = "guessed-module-id"; },
      r => { r.result.recommended_path.next_modules = ["Unknown"]; },
      r => { r.result.practice_shift.honesty_note = "x".repeat(4097); },
    ];
    for (const mutate of mutations) {
      const record = privateResultFixture(); mutate(record);
      expect(() => restorePrivateWebResult(record), String(mutate)).toThrow("Invalid private web result");
    }
    for (const invalid of [null, undefined, [], {}, "{", " ".repeat(65537)]) {
      expect(() => restorePrivateWebResult(invalid)).toThrow("Invalid private web result");
    }
  });
  test("preserves the entire v1 record including null overall and unobserved focus without reconstruction", async () => {
    const { restorePrivateWebResult } = await adapter();
    for (const overall of [null, 0, 67.125, 100]) {
      const record = privateResultFixture();
      record.result.starting_index.overall = overall;
      const restored = restorePrivateWebResult(JSON.stringify(record));
      expect(restored).toEqual(record);
      expect(restorePrivateWebResult(record)).toEqual(record);
      expect(restored.result.starting_index.overall).toBe(overall);
      expect(restored.result.starting_index.observed_dimensions).toHaveLength(1);
      restored.result.practice_shift.current_pattern[0] = "mutation";
      expect(record.result.practice_shift.current_pattern[0]).toBe("First");
    }
  });
});
