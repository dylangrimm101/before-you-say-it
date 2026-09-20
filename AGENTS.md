# BYSI release and regression requirements

Before rehearsal/onboarding work or a release-readiness claim, read
`handoff/SPOKEN-RELEASE-CHECKLIST.md` and `handoff/TESTING.md`.

- Speaking is the primary flow. Test both Record/Stop/approval sequences, both
  counterpart responses/audio points, final approval, and debrief on all tracks.
- Mocked successful provider replies are not real-provider acceptance. Changes
  touching this flow require the checklist's separately authorized, bounded
  real-provider candidate check and explicit physical-device acceptance status.
- Preserve a regression for each reported failure. Exercise second-response
  failure and Retry through mounted screen controls, including duplicate taps,
  retained text, no rerecording, and completion. Do not stop at the repaired step.
- Record exact source/build/backend pins, fixture substitutions, failures, and
  untested stages. Never silently count skipped, unavailable, or historical checks
  as passing. Separate a reproduced defect from an unproven incident cause.
- Never weaken authentication, ownership, proof/text authorization, or accounting
  to get a test passing. A plausible-response fixture must not be engineered only
  to contain every token required by the implementation under test.
- Testing policy does not grant deployment, live spending, production data access,
  or configuration-change authority. Obtain applicable approval first.
- Run `bun run test:release` for rehearsal candidates, with the pinned external
  renderer/backend fixtures and network denied. Missing prerequisites fail the
  gate. Use `handoff/RELEASE-EVIDENCE-TEMPLATE.md` for every candidate; never turn
  its pending provider/device entries green from an automated pass.
- Reproduce each reported defect before fixing it, record the failing assertion
  and passing rerun, then repeat the full three-track journey. If reproduction is
  unavailable, label the proposed cause unverified. Keep unrelated edits out.
- Bind the tested source to the uploaded artifact and confirm the installed
  TestFlight build before asking the user to retest. A candidate may be uploaded
  for device acceptance with approval; it is not fully accepted until that passes.
