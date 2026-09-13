# Private web result restoration (staged, not activated)

## Integration entry points

- `lib/privateWebResult.ts`: `restorePrivateWebResult(input: unknown)` accepts a decoded object or JSON string for `schema_version: 1`, `kind: bysi_private_web_result`, output version `bysi-free-rehearsal-result-v1-2026-08-12`.
- `components/PrivateWebResultPresentation.tsx`: validates unknown input itself, then renders all retained result text and scores. Invalid input renders only “Saved result unavailable.” Host components are injected so the same actual React renderer can be exercised without mocking the native runtime.

After a future authenticated, ownership-scoped private read, native composition is:

```tsx
import { ScrollView, View, Text } from "react-native";
import { PrivateWebResultPresentation } from "@/components/PrivateWebResultPresentation";

// privateRecord is obtained by the future authenticated hydration layer,
// NOT from a deep link, checkout metadata, analytics, or browser-posted scores.
<ScrollView>
  <PrivateWebResultPresentation
    record={privateRecord}
    Container={View}
    Text={Text}
  />
</ScrollView>
```

Host components can wrap styled native View/Text. This is a composition example, not an installed navigation route or a fetch API. No route, account provider, store, entitlement gate, or activation handler has changed.

## Fidelity and privacy

The adapter independently mirrors the web codec's nested allowlists, field validation, exact supported dimensions/modules, dimension partition, identifier format, bounded strings/lists, and 64 KiB UTF-8 projected record limit. It preserves all allowed fields without trimming, rounding, coercion, averaging, invented observed focus, reordering sequences, or guessing module IDs. Null overall stays null; the renderer labels it “Not scored,” never zero. Unobserved dimensions remain names without fabricated scores. Explicit null observed-dimension scores are now accepted by the compatible v1 validators and remain null; the renderer labels them “Not scored.” Missing serialized fields and numeric strings remain invalid. The real producer normalizes missing provider scores to null before encoding.

Nullable-score follow-up: `bun test __tests__/privateWebResult.test.ts __tests__/privateWebResultRoundtrip.test.ts` passed 5 tests / 138 assertions; `bun run check` passed. The roundtrip executes the actual web producer with synthetic provider responses, codec → JSON → native restoration and rendering for missing/null/zero/fractional/100 observed scores. Set `BYSI_WEB_ROOT` to override the sibling web checkout path. The test binds only a synthetic rehearsal ID and does not activate capture or authenticate ownership. RED failures were observed separately at codec, adapter and presentation before fixes. Earlier full-suite evidence below is historical, not a new full-native-suite run.

The returned record is a detached projection. Unknown private/provider fields are dropped at each nested boundary. Provenance is retained in the record but not rendered. Validation errors do not contain input/parser excerpts. Allowlisted evidence and summaries remain sensitive, even though raw transcript fields are excluded.

Do not reuse `buildFreeJourneyResult`, `SharedProductContract`, `ActivePracticeSession`, or scored-practice history for this record. There is no approved transcript, rewrite, replay audio, attempt, completion, practice identifier, or paid access proof. The renderer omits those features and states that transcript/rewrite are not included. It renders a recommendation as stored text, not a guessed navigable curriculum mapping.

## Remaining boundary

This validates shape, not origin or ownership. A `source: server_generation` string is not authentication. Before customer use, supply authenticated ownership-scoped private DB reads, owner/result reference binding, lifecycle-safe hydration that clears on logout/account changes, retention/deletion policy, and explicit activation integration. Keep the record out of navigation params, analytics/logs, public storage, and billing metadata. Do not persist it through the current practice-session storage path. RevenueCat remains the unchanged paid access authority in native.

No endpoint or unauthenticated fetch is supplied. Current entry/login copy correctly continues to say web result restoration and subscription activation are unavailable in this build.

## Verification

Strict RED→GREEN cycles: exact record restoration; invalid/version/partition rejection; nested privacy projection and UTF-8 size; actual React result-only rendering. Synthetic fixtures are labeled and are not provider/customer evidence.

- `bun test __tests__/privateWebResult.test.ts`: 4 passed, 97 assertions.
- `bun run test`: 1014 passed, 0 failed across 81 files.
- `bun run check`: passed.
- Targeted ESLint for all three new code/test files: passed.
- `git diff --check`: passed.
- Separate read-only compatibility execution imported the actual web `encodeResult` and native adapter: four synthetic codec→JSON→native deep-equality round trips passed for null, zero, fractional, and 100 overall values.

React rendering was exercised with HTML host elements; no simulator/device visual verification or live auth/hydration is claimed.
