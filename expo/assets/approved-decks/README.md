# Approved executable deck assets

These twelve HTML files are exact UTF-8 bytes from the SHA-256-pinned authoritative handoff archive. They are not the truncated review files in `assets/lesson-decks`. Do not edit them. Regenerate using `scripts/package-approved-decks.py` and the pinned ZIP; the script validates archive identity, paths, CRC, UTF-8 round trips, and source digests.

`index.ts` statically requires every file so Metro packages all twelve with native releases while keeping the corpus out of JS/Hermes string tables. `metro.config.js` registers HTML as an opaque asset. The loader resolves only the requested asset through expo-asset, reads native local files/resources through expo-file-system/legacy, and verifies manifest SHA-256 before running existing transformations. No native asset downloads or remote fallback are allowed. Android release raw resource identifiers, iOS file URIs, and expo-updates localUri are supported. Remote-only Expo Go/dev-server assets fail closed; use an embedded release build for offline acceptance.

Web uses the emitted asset URL with fetch, validates HTTP success, then checks the same digest. This does not add a service worker or guarantee a browser cold offline launch.

Packaging verification should include both `expo export --platform all` and `expo export:embed --platform ios|android --dev false --assets-dest <isolated directory>` with appropriate entry/bundle-output arguments. Verify all twelve digests in native embedding output (iOS assets, Android res/raw), export manifests, and HTTP-served web assets. Unit tests substitute native bridges but read the real files with networking disabled. Physical-device offline first-launch and WebView rendering remain separate release checks.
