# Routing, scenario lifecycle, and accessibility launch QA

## Scope

Launch-blocking recovery work for standalone paid scenarios, native deep links, account-state copy, unavailable routes, selection semantics, and Today-card scaling. Curriculum scene/provider implementation was not changed.

## Automated coverage

`__tests__/routingLifecycleA11y.test.ts` verifies:

- an empty scenario slot creates a new run;
- the same unfinished standalone scenario resumes its exact run ID;
- a completed or different standalone scenario is retired before a new run starts;
- active lesson rehearsals are protected from silent replacement;
- standalone runs expose Save and leave / Abandon rehearsal paths and completion cleanup;
- supported static, tab, and dynamic app links survive native-intent validation;
- foreign origins, traversal, unknown paths, and internal QA routes fall back to `/`;
- missing drills and production-closed internal routes have normal recovery actions;
- Settings copy follows the authenticated user/loading/configuration state;
- onboarding, scenario difficulty, and billing options expose radio/selected semantics;
- Today cards use `minHeight`, unrestricted activity copy, and normal responsive flow.

Existing Today tests were updated to lock the new responsive behavior. Existing active-run repository and scenario-continuity suites remain green.

## Manual launch checks

1. Start a standalone paid scenario, leave with **Save and leave**, reopen the same scenario, and confirm the exact checkpoint resumes.
2. Leave with **Abandon rehearsal**, then start any scenario and confirm no active-slot error appears.
3. Complete a standalone scenario and confirm the app returns to Scenarios; start another scenario immediately.
4. Simulate cleanup failure and confirm the completed run remains saved, the error is visible, and **Back to Scenarios** retries cleanup. Starting another scenario must retire the completed run rather than remain blocked.
5. While a lesson rehearsal is active, try to start a standalone scenario and confirm the lesson is not discarded.
6. Open supported links (`/settings`, `/(tabs)/progress`, `/scenario/<id>`, `/drill/<id>`). Confirm unsupported, foreign-host, traversal, and internal-QA links land safely at root.
7. Open a nonexistent drill and production builds of internal review routes; confirm a visible Library/Today recovery action.
8. Check Settings while auth is loading, signed out, signed in, and auth-unconfigured. Confirm it never labels a signed-in user as signed out.
9. With VoiceOver/TalkBack, inspect onboarding choices, difficulty choices, and monthly/annual plans. Confirm each announces radio role and selected state.
10. At maximum text size and on a compact screen, inspect Today cards. Confirm titles/body copy and controls expand vertically without clipping or card overlap.

## Verification commands

```sh
bun test
bun run check
bun run lint
bun run export
```

Any pre-existing non-error lint warning is recorded in the final verification result.
