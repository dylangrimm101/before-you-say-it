# Deterministic Test Evidence

Executed from `expo` on 2026-08-25.

- Focused correction tests: 99 passed, 0 failed, 447 assertions across 8 files.
- Complete suite: 713 passed, 0 failed across 45 files.
- `bunx tsc --noEmit`: passed with no diagnostics.
- `bun run lint`: passed with no errors or warnings.
- Rork validation: passed with no errors.
- `bunx expo export --platform all`: passed for web, iOS, and Android; 77 assets, 3 web bundles, 1 iOS bundle, 1 Android bundle, and 3 root files.
- The final export recovered from an obsolete Metro cache by performing a full crawl and completed successfully.

Added deterministic coverage includes:

- temporary and retained filesystem deletion failures;
- completion crashes before deletion, after deletion, and after progress write but before journal cleanup;
- stale/interleaved active-run compare-and-swap races and cross-practice clear/archive attempts;
- every Hope comparison status transition;
- opener/Beat 3/Beat 5 coaching selection and exact evidence;
- tampered pressure text, reaction, semantic voice, audio ID, run ID, and authored order;
- direct final-retry capture before replay;
- exact Beat 7 replay staging;
- malformed incoming progress;
- direct-question pressure selection;
- exact Cards 21–22 inventory and optional Card 21 blanks;
- work-category resume isolation and contextual voice playback boundaries.
