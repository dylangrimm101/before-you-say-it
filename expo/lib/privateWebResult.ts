/** Result-only data, deliberately not a SharedProductContract or practice session. */
export interface PrivateWebResult {
  schema_version: 1;
  kind: "bysi_private_web_result";
  provenance: {
    generation_id: string; rehearsal_id: string; provider_request_id: string;
    model: string; generated_at: string; producer_version: string; source: "server_generation";
  };
  result: {
    mode: "result";
    outputVersion: "bysi-free-rehearsal-result-v1-2026-08-12";
    pressure_moment: { headline: string; conclusion: string; how_bysi_read_this: { observed: string; why_it_matters: string; confidence: string } };
    practice_shift: { headline: string; current_pattern: string[]; practice_target: string[]; goal_line: string; honesty_note: string };
    starting_index: { overall: number | null; label: string; coverage_note: string; score_note: string; focus_dimension: string; observed_dimensions: { name: string; score: number | null; evidence: string }[]; unobserved_dimensions: string[] };
    recommended_path: { first_module: string; reason: string; next_modules: string[] };
  };
}

const DIMENSIONS = ["Clarity", "Specificity", "Listening", "Steadiness", "Boundaries", "Repair"];
const MODULES = ["Get to the Point", "Make a Clear Ask", "Start the Conversation", "Listen and Respond", "Stay Clear Under Pushback", "Pause, Say No, or Set a Boundary", "Repair What Went Wrong", "Use It in Real Life"];
const text = (v: unknown): boolean => typeof v === "string" && v.trim().length > 0 && v.length <= 4096;
const score = (v: unknown): boolean => typeof v === "number" && Number.isFinite(v) && v >= 0 && v <= 100;
const list = (v: unknown, min: number, max: number, check: (item: any) => boolean = text): boolean =>
  Array.isArray(v) && v.length >= min && v.length <= max && v.every(check);
function requireValid(condition: unknown): asserts condition {
  if (!condition) throw new Error("Invalid private web result");
}

/** Pure validation, not authentication. Call only after an ownership-scoped private read. */
export function restorePrivateWebResult(input: unknown): PrivateWebResult {
  try {
    if (typeof input === "string") requireValid(input.length <= 65536);
    const value = (typeof input === "string" ? JSON.parse(input) : input) as PrivateWebResult;
    requireValid(value?.schema_version === 1 && value.kind === "bysi_private_web_result");
    const p = value.provenance, r = value.result;
    requireValid(p?.source === "server_generation");
    for (const key of ["generation_id", "rehearsal_id", "provider_request_id", "model", "producer_version"] as const) {
      requireValid(typeof p[key] === "string" && /^[A-Za-z0-9_.:-]{1,160}$/.test(p[key]));
    }
    requireValid(text(p.generated_at) && Number.isFinite(Date.parse(p.generated_at)));
    requireValid(r?.mode === "result" && r.outputVersion === "bysi-free-rehearsal-result-v1-2026-08-12");
    const pm = r.pressure_moment, ps = r.practice_shift, idx = r.starting_index, path = r.recommended_path;
    requireValid(pm && ps && idx && path);
    requireValid(text(pm.headline) && text(pm.conclusion));
    requireValid(["observed", "why_it_matters", "confidence"].every(k => text(pm.how_bysi_read_this?.[k as keyof typeof pm.how_bysi_read_this])));
    requireValid(text(ps.headline) && text(ps.goal_line) && text(ps.honesty_note));
    requireValid(list(ps.current_pattern, 3, 4) && list(ps.practice_target, 3, 4));
    requireValid(idx.overall === null || score(idx.overall));
    requireValid(text(idx.label) && text(idx.coverage_note) && text(idx.score_note));
    requireValid(DIMENSIONS.includes(idx.focus_dimension));
    requireValid(list(idx.observed_dimensions, 1, 3, row => row && DIMENSIONS.includes(row.name) && (row.score === null || score(row.score)) && text(row.evidence)));
    requireValid(list(idx.unobserved_dimensions, 3, 5, name => DIMENSIONS.includes(name)));
    const names = [...idx.observed_dimensions.map(row => row.name), ...idx.unobserved_dimensions];
    requireValid(names.length === 6 && new Set(names).size === 6);
    requireValid(MODULES.includes(path.first_module) && text(path.reason) && list(path.next_modules, 0, 3, name => MODULES.includes(name)));
    const record: PrivateWebResult = {
      schema_version: 1, kind: "bysi_private_web_result",
      provenance: { generation_id: p.generation_id, rehearsal_id: p.rehearsal_id, provider_request_id: p.provider_request_id, model: p.model, generated_at: p.generated_at, producer_version: p.producer_version, source: p.source },
      result: {
        mode: r.mode, outputVersion: r.outputVersion,
        pressure_moment: { headline: pm.headline, conclusion: pm.conclusion, how_bysi_read_this: { observed: pm.how_bysi_read_this.observed, why_it_matters: pm.how_bysi_read_this.why_it_matters, confidence: pm.how_bysi_read_this.confidence } },
        practice_shift: { headline: ps.headline, current_pattern: [...ps.current_pattern], practice_target: [...ps.practice_target], goal_line: ps.goal_line, honesty_note: ps.honesty_note },
        starting_index: { overall: idx.overall, label: idx.label, coverage_note: idx.coverage_note, score_note: idx.score_note, focus_dimension: idx.focus_dimension, observed_dimensions: idx.observed_dimensions.map(row => ({ name: row.name, score: row.score, evidence: row.evidence })), unobserved_dimensions: [...idx.unobserved_dimensions] },
        recommended_path: { first_module: path.first_module, reason: path.reason, next_modules: [...path.next_modules] },
      },
    };
    // JSON escapes lone surrogates; count UTF-8 without Node Buffer/native polyfills.
    const serialized = JSON.stringify(record);
    const bytes = encodeURIComponent(serialized).replace(/%[A-F0-9]{2}/g, "x").length;
    requireValid(bytes <= 65536);
    return record;
  } catch {
    // Never include sensitive payloads or parser excerpts in errors/logs.
    throw new Error("Invalid private web result");
  }
}
