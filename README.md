# Before You Say It — local Expo handoff

**Expo / React Native only. Prepared locally; not published, activated in Rork, built, exported, or deployed.**

Start with [handoff/HANDOFF.md](handoff/HANDOFF.md). The canonical mobile application is `expo/`; `rork.json` selects only that application. This is not a Swift conversion or a new-project import.

- Reviewed mobile source: `d0a068a1ee849144caf65811f4bf0c457056515a` in the separately private `dylangrimm101/before-you-say-it-web` repository.
- Implementation pin: `e863721be645cc187fabb021aa405b0509af13c9` (identical `expo/` tree).
- Base: existing mobile `main` at `0681578a7c12fa38af7613825264d9d94a807dac`.
- Dedicated local branch: `handoff/expo-reviewed-20260916`. Obtain its final identity with `git rev-parse HEAD`; never substitute `main` or an older TestFlight branch.

## Offline checks only

```sh
python3 handoff/check.py --install
# Optional private composed gates, after preparing pinned test-deps in that separate checkout:
python3 handoff/check.py --private-source /absolute/path/to/private-reviewed-checkout
```

No credentials are needed for these checks. See [TESTING.md](handoff/TESTING.md) for explicit seams and limitations. Do not run inherited export, release, provider-QA or staging smoke scripts without separate authorization.

**Publication and activation are blocked:** repository privacy and the existing Rork Expo project's private-repository access, active sync branch, branch-selection support and build triggers must be verified before separately authorizing publication. The user is obtaining Rork's response. A Git push does not prove Rork activation. Preserve the existing Expo project; do not initiate a new-project import or Swift/Kotlin conversion.
